"""Build the stop-motion flipbook used by the book scene.

Two moves, delivered as drawings on an exposure sheet and played with hard cuts only:

closed -> open    The generated video supplies the page-turning motion. Every frame is warped
                  into the HD still geometry in one resample, colour-fitted to the neighbouring
                  keys and lightly sharpened. Wherever a page is at rest, the HD still is
                  tracked onto it (per-page affine, ECC), relit by the video's low-frequency
                  shading and laid in, so settled type is crisp instead of the video's soft,
                  garbled text. The last near-still drawings dissolve into the still offline,
                  so the page lands on the exact HD still with no live blending.
open -> entered   A camera push built from the open HD still, motion-control style: each
                  drawing is a crisp re-framing, eased in log scale and exposed on ones. It
                  comes to rest and cuts in to the close-up still. (The video's own push was
                  soft and morphed the page layout: that was the "blur" between the keys.)

Output: public/media/book-flip/{desktop,mobile}/*.webp and sheet.json.
Run from the project root:  python production/book/stopmotion/build_flipbook.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
VIDEO = ROOT / 'production/book/joined.mp4'
STILLS = {
    'closed': ROOT / 'public/art/book-closed.png',
    'open': ROOT / 'public/art/book-open-hd.png',
    'entered': ROOT / 'public/art/book-entered-hd.png',
}
OUT = ROOT / 'public/media/book-flip'
QA = ROOT / 'production/book/stopmotion/qa'
SIZES = {'desktop': 1672, 'mobile': 960}
KEY_SOURCE = {'closed': 0, 'open': 104, 'entered': 242}

# closed -> open: lead drawings, motion range, drawings in motion, tail drawings (video sources).
LEAD, MOTION, MOTION_DRAWINGS, TAIL = [4], (7, 90), 23, [92, 96]
EASE = 0.38          # share of classic ease-in/out mixed into even motion spacing
TICKS_PER_SECOND = 24

# Detail transfer. Tracking windows (y0, y1, x0, x1) in still pixels.
PAGES = {'right': (120, 780, 860, 1480), 'left': (110, 790, 200, 800)}
TRACK_FROM = 76      # before this the pages are still turning: video only
TRACK_MIN_CC = 0.9   # a page whose fit drops below this is left to the video from then on
EARLY_TO = 14        # up to here the closed book is at rest: the closed still is laid in

# open -> entered: zoom about a point on the right edge, so the last framing is centred on
# the part of the page the close-up shows (~(1150, 385) in the open still).
PUSH_FOCUS = (1671.0, 242.0)
PUSH_SCALE = 1.6
PUSH_DRAWINGS = 20


def read_video() -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(VIDEO))
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if not frames:
        raise SystemExit(f'cannot read {VIDEO}')
    return frames


def read_still(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGB'))


def gray(img: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    small = cv2.resize(img, size, interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(small, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255


def measure_warp(frame: np.ndarray, still: np.ndarray) -> np.ndarray:
    """Affine mapping still pixel coordinates to coordinates in `frame` resized to still size."""
    h, w = still.shape[:2]
    half = (w // 2, h // 2)
    warp = np.eye(2, 3, dtype=np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7)
    _, warp = cv2.findTransformECC(gray(still, half), gray(frame, half), warp, cv2.MOTION_AFFINE, criteria, None, 5)
    warp[:, 2] *= 2
    return warp.astype(np.float64)


def compose_source_map(warp: np.ndarray, src_shape, dst_shape) -> np.ndarray:
    """Fold 'resize video to still size' into the affine so each frame is resampled once."""
    sh, sw = src_shape[:2]
    dh, dw = dst_shape[:2]
    sx, sy = dw / sw, dh / sh
    m = np.array(warp, dtype=np.float64)
    out = np.empty((2, 3))
    out[0, :2] = m[0, :2] / sx
    out[1, :2] = m[1, :2] / sy
    out[0, 2] = (m[0, 2] + 0.5) / sx - 0.5
    out[1, 2] = (m[1, 2] + 0.5) / sy - 0.5
    return out


def register(frame: np.ndarray, source_map: np.ndarray, shape) -> np.ndarray:
    h, w = shape[:2]
    return cv2.warpAffine(frame, source_map, (w, h), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REPLICATE)


def fit_colour(frame: np.ndarray, still: np.ndarray) -> np.ndarray:
    """3x4 affine colour transform frame -> still, fitted on registered pixels."""
    h, w = still.shape[:2]
    my, mx = int(h * 0.04), int(w * 0.04)
    a = frame[my:h - my:3, mx:w - mx:3].reshape(-1, 3).astype(np.float64)
    b = still[my:h - my:3, mx:w - mx:3].reshape(-1, 3).astype(np.float64)
    keep = np.ones(len(a), dtype=bool)
    for _ in range(3):
        x = np.hstack([a[keep], np.ones((keep.sum(), 1))])
        m, *_ = np.linalg.lstsq(x, b[keep], rcond=None)
        residual = np.abs(np.hstack([a, np.ones((len(a), 1))]) @ m - b).sum(1)
        keep = residual < np.percentile(residual, 92)
    return m  # (4, 3)


def apply_colour(frame: np.ndarray, m: np.ndarray) -> np.ndarray:
    flat = frame.reshape(-1, 3).astype(np.float32)
    out = flat @ m[:3].astype(np.float32) + m[3].astype(np.float32)
    return out.reshape(frame.shape)


def laplacian_energy(img: np.ndarray) -> float:
    g = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    h, w = g.shape
    return float(cv2.Laplacian(g[h // 5:-h // 5, w // 5:-w // 5], cv2.CV_64F).var())


def sharpen(img: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0:
        return img
    blur = cv2.GaussianBlur(img, (0, 0), 1.1)
    return img + (img - blur) * amount


def pick_drawings(motion: np.ndarray, first: int, last: int, count: int) -> list[int]:
    """Space drawings evenly in accumulated motion, then ease the ends."""
    energy = np.concatenate([[0.0], np.cumsum(motion[first:last])])  # energy[i] at source first+i
    energy /= energy[-1]
    picks = []
    for k in range(1, count + 1):
        u = k / (count + 1)
        smooth = u * u * (3 - 2 * u)
        target = (1 - EASE) * u + EASE * smooth
        picks.append(first + int(np.clip(np.searchsorted(energy, target), 1, last - first - 1)))
    unique = []
    for p in picks:
        if unique and p <= unique[-1]:
            p = unique[-1] + 1
        unique.append(min(p, last - 1))
    return sorted(set(unique))


# ---- Detail transfer: lay the HD still into the video wherever the page is at rest ----

def blur(x: np.ndarray, sigma: float) -> np.ndarray:
    return cv2.GaussianBlur(x, (0, 0), sigma)


def luma(img: np.ndarray) -> np.ndarray:
    return img.astype(np.float32) @ np.float32([.299, .587, .114])


def ramp(x: np.ndarray, a: float, b: float) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def track_page(frame: np.ndarray, still: np.ndarray, page: str, start: np.ndarray) -> tuple[np.ndarray | None, float]:
    """Affine (full-image coordinates) that places the page of the still where it sits in `frame`."""
    y0, y1, x0, x1 = PAGES[page]
    template = blur(luma(still)[y0:y1, x0:x1] / 255, 1.5)
    image = blur(luma(frame)[y0:y1, x0:x1] / 255, 1.5)
    origin = np.float64([x0, y0])
    warp = start.copy()
    warp[:, 2] = warp[:, 2] - origin + warp[:, :2] @ origin
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 120, 1e-6)
    try:
        cc, warp = cv2.findTransformECC(template, image, warp.astype(np.float32), cv2.MOTION_AFFINE, criteria, None, 5)
    except cv2.error:
        return None, 0.0
    warp = warp.astype(np.float64)
    warp[:, 2] = warp[:, 2] + origin - warp[:, :2] @ origin
    return warp, float(cc)


def agreement(frame: np.ndarray, ref: np.ndarray) -> np.ndarray:
    """1 where frame and reference show the same detail (band-pass NCC) or the same flat tone."""
    a, b = luma(frame), luma(ref)
    ba, bb = blur(a, 2.5) - blur(a, 9), blur(b, 2.5) - blur(b, 9)
    box = lambda x: cv2.blur(x, (41, 41))
    va, vb, cov = box(ba * ba), box(bb * bb), box(ba * bb)
    ncc = cov / np.sqrt(va * vb + 1e-2)
    high = np.maximum(va, vb)
    textured = ramp(ncc, .45, .75) * ramp(np.minimum(va, vb) / np.maximum(high, 1e-6), .2, .45)
    flat = 1 - ramp(np.abs(blur(a, 4) - blur(b, 4)), 6, 16)
    mask = (np.where(high > 4, textured, flat) > .5).astype(np.uint8)
    disc = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r, r))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, disc(15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, disc(31))
    return cv2.erode(mask, disc(9)).astype(np.float32)


def lay_in(frame: np.ndarray, base: np.ndarray, ref: np.ndarray, region: np.ndarray) -> np.ndarray:
    """Composite `ref` over `frame` where it agrees with the video (`base`), relit by its shading."""
    mask = agreement(base, ref) * region
    if mask.sum() < 1000:
        return frame
    weight = blur(mask, 10) + 1e-4
    lit_video = blur(base * mask[..., None], 10) / weight[..., None]
    lit_ref = blur(ref * mask[..., None], 10) / weight[..., None]
    relit = ref * np.clip(lit_video / np.maximum(lit_ref, 1), .6, 1.4)
    soft = blur(mask, 4)[..., None]
    return soft * relit + (1 - soft) * frame


def region_of(page: str, shape) -> np.ndarray:
    y0, y1, x0, x1 = PAGES[page]
    region = np.zeros(shape[:2], np.float32)
    region[max(0, y0 - 60):y1 + 60, max(0, x0 - 60):x1 + 60] = 1
    return region


# ---- The push ----

def reframe(still: np.ndarray, scale: float) -> np.ndarray:
    """The still as seen by a camera pushed in `scale` times about PUSH_FOCUS."""
    h, w = still.shape[:2]
    fx, fy = PUSH_FOCUS
    m = np.float64([[1 / scale, 0, fx * (1 - 1 / scale)], [0, 1 / scale, fy * (1 - 1 / scale)]])
    return cv2.warpAffine(still, m, (w, h), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REPLICATE)


def encode(img: np.ndarray, path: Path, width: int, quality: int) -> int:
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    if pil.width != width:
        pil = pil.resize((width, round(pil.height * width / pil.width)), Image.LANCZOS)
    pil.save(path, 'WEBP', quality=quality, method=6)
    return path.stat().st_size


def main() -> None:
    frames = read_video()
    stills = {k: read_still(p) for k, p in STILLS.items()}
    shape = stills['open'].shape

    warps = [measure_warp(frames[i], stills[k]) for k, i in KEY_SOURCE.items()]
    warp = np.mean(warps, axis=0)
    print('warp', np.round(warp, 5).tolist())
    source_map = compose_source_map(warp, frames[0].shape, shape)

    colour = {}
    for k, i in KEY_SOURCE.items():
        registered = register(frames[i], source_map, shape).astype(np.float32)
        colour[k] = fit_colour(registered, stills[k].astype(np.float32))
        before = np.abs(registered - stills[k]).mean()
        after = np.abs(apply_colour(registered, colour[k]) - stills[k]).mean()
        print(f'colour {k}: mean abs diff {before:.2f} -> {after:.2f}')

    # Match detail: pick the unsharp amount whose Laplacian energy is closest to the still.
    i = KEY_SOURCE['open']
    base = apply_colour(register(frames[i], source_map, shape).astype(np.float32), colour['open'])
    target = laplacian_energy(stills['open'])
    amount = min((abs(laplacian_energy(sharpen(base, a)) - target), a) for a in np.arange(0, 2.01, 0.1))[1]
    print(f'sharpen amount {amount:.1f} (still energy {target:.0f})')

    def prepare(src: int) -> np.ndarray:
        t = src / KEY_SOURCE['open']
        m = colour['closed'] * (1 - t) + colour['open'] * t
        return sharpen(apply_colour(register(frames[src], source_map, shape).astype(np.float32), m), amount)

    motion = np.array([np.abs(gray(frames[j + 1], (336, 189)) - gray(frames[j], (336, 189))).mean() * 255
                       for j in range(len(frames) - 1)])
    drawings = LEAD + pick_drawings(motion, *MOTION, MOTION_DRAWINGS) + TAIL
    print('open drawings', drawings)

    # Track each page back from the rest pose, a couple of source frames at a time.
    still_open = stills['open'].astype(np.float32)
    chain = sorted(set(range(KEY_SOURCE['open'], TRACK_FROM - 1, -2)) | {d for d in drawings if d >= TRACK_FROM}, reverse=True)
    state = {page: np.eye(2, 3) for page in PAGES}
    placed: dict[int, dict[str, np.ndarray]] = {}
    for src in chain:
        img = prepare(src)
        for page in PAGES:
            if state[page] is None:
                continue
            found, cc = track_page(img, still_open, page, state[page])
            state[page] = found if found is not None and cc >= TRACK_MIN_CC else None
            if state[page] is not None and src in drawings:
                placed.setdefault(src, {})[page] = state[page]
        if src in drawings:
            print(f'  {src}: tracked', ', '.join(placed.get(src, {})) or 'none')

    if OUT.exists():
        shutil.rmtree(OUT)
    for size in SIZES:
        (OUT / size).mkdir(parents=True)
    QA.mkdir(parents=True, exist_ok=True)

    sizes = {name: 0 for name in SIZES}

    def write(name: str, img: np.ndarray, quality: int) -> str:
        file = f'{name}.webp'
        for size, width in SIZES.items():
            sizes[size] += encode(img, OUT / size / file, width, quality)
        return file

    sheet_frames = []
    keys = {}
    contact = []

    def add(file: str, source: int | None, ticks: int, kind: str) -> None:
        sheet_frames.append({'file': file, 'source': source, 'ticks': ticks, 'kind': kind})

    def add_key(key: str) -> None:
        add(write(key, stills[key].astype(np.float32), 92), KEY_SOURCE[key], 3, 'key')
        keys[key] = len(sheet_frames) - 1
        contact.append((key, stills[key]))

    add_key('closed')
    everywhere = np.ones(shape[:2], np.float32)
    for n, src in enumerate(drawings):
        base = prepare(src)
        img = base
        if src <= EARLY_TO:
            img = lay_in(img, base, stills['closed'].astype(np.float32), everywhere)
        if src in placed:
            pages = np.zeros(shape[:2], np.float32)
            for page, page_warp in placed[src].items():
                ref = cv2.warpAffine(still_open, page_warp.astype(np.float32), (shape[1], shape[0]),
                                     flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
                img = lay_in(img, base, ref, region_of(page, shape))
                pages = np.maximum(pages, region_of(page, shape))
            img = lay_in(img, base, still_open, 1 - pages)  # the desk and book edges
        if src in LEAD:
            w = (len(LEAD) - LEAD.index(src)) / (len(LEAD) + 1)
            img = img * (1 - w) + stills['closed'].astype(np.float32) * w
        if src in TAIL:
            w = (TAIL.index(src) + 1) / (len(TAIL) + 1)
            img = img * (1 - w) + still_open * w
        file = write(f'open-{src:03d}', img, 80)
        # Ease out on the settling drawings: hold them a tick longer.
        add(file, src, 3 if n >= len(drawings) - len(TAIL) - 1 else 2, 'drawing')
        contact.append((f'{src}', img))
    add_key('open')

    for k in range(1, PUSH_DRAWINGS + 1):
        u = k / PUSH_DRAWINGS
        eased = u * u * u * (u * (u * 6 - 15) + 10)
        scale = PUSH_SCALE ** eased
        img = sharpen(reframe(still_open, scale), 0.3 * (scale - 1) / (PUSH_SCALE - 1))
        file = write(f'push-{k:02d}', img, 82)
        add(file, None, 3 if k == PUSH_DRAWINGS else 1, 'drawing')
        contact.append((f'push {scale:.2f}', img))
        if k == PUSH_DRAWINGS:
            Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(QA / 'push-rest.png')
    add_key('entered')

    sheet = {
        'version': 1,
        'ticksPerSecond': TICKS_PER_SECOND,
        'width': shape[1],
        'height': shape[0],
        'sizes': SIZES,
        'keys': keys,
        'frames': sheet_frames,
    }
    (OUT / 'sheet.json').write_text(json.dumps(sheet, indent=1), encoding='utf-8')
    for size, total in sizes.items():
        print(f'{size}: {total / 1e6:.1f} MB')

    thumbs = [Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((320, 180), Image.LANCZOS)
              for _, img in contact]
    cols = 8
    rows = (len(thumbs) + cols - 1) // cols
    board = Image.new('RGB', (cols * 324, rows * 204), 'white')
    for idx, thumb in enumerate(thumbs):
        board.paste(thumb, ((idx % cols) * 324, (idx // cols) * 204))
    board.save(QA / 'exposure-sheet.jpg', quality=85)
    print('frames', len(sheet_frames), 'keys', keys)


if __name__ == '__main__':
    main()
