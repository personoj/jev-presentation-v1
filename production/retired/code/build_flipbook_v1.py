"""Build the stop-motion flipbook used by the book scene.

The generated video and the three HD stills disagree by ~1.5 % in scale, a few
pixels in position and in tone. Cross-fading between them produced the brief
"ghost" blur. This script removes the disagreement before the browser sees it:

1. every video frame is warped into the still geometry (one affine, measured
   by ECC against the three keyframes) and upscaled in a single resample;
2. its colour is fitted to the neighbouring keyframes (3x4 least squares,
   interpolated over time) and lightly sharpened to match still detail;
3. frames are picked on an exposure sheet from the motion curve, like an
   animator spacing drawings, and exposed on twos (12 drawings / second);
4. the last, almost motionless drawings dissolve into the still *offline*,
   where both images are already registered, so the page lands on the exact
   HD still without any live blending.

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

# Source ranges. The spread is at rest from ~92 to ~118 and the push settles at ~229.
# Lead/tail drawings sit in those near-still stretches; only they dissolve toward a
# still, so registered images are blended while nothing on the page is moving.
SEGMENTS = [
    # name, from key, to key, lead drawings, motion range, drawings in motion, tail drawings
    ('open', 'closed', 'open', [4], (7, 90), 23, [92, 96]),
    ('entered', 'open', 'entered', [120], (123, 227), 24, [230, 234]),
]
EASE = 0.38          # share of classic ease-in/out mixed into even motion spacing
TICKS_PER_SECOND = 24


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
    key_source = {'closed': 0, 'open': 104, 'entered': 242}

    warps = [measure_warp(frames[i], stills[k]) for k, i in key_source.items()]
    warp = np.mean(warps, axis=0)
    print('warp', np.round(warp, 5).tolist())
    source_map = compose_source_map(warp, frames[0].shape, shape)

    colour = {}
    for k, i in key_source.items():
        registered = register(frames[i], source_map, shape).astype(np.float32)
        colour[k] = fit_colour(registered, stills[k].astype(np.float32))
        before = np.abs(registered - stills[k]).mean()
        after = np.abs(apply_colour(registered, colour[k]) - stills[k]).mean()
        print(f'colour {k}: mean abs diff {before:.2f} -> {after:.2f}')

    # Match detail: pick the unsharp amount whose Laplacian energy is closest to the still.
    k, i = 'open', key_source['open']
    base = apply_colour(register(frames[i], source_map, shape).astype(np.float32), colour[k])
    target = laplacian_energy(stills[k])
    amount = min((abs(laplacian_energy(sharpen(base, a)) - target), a) for a in np.arange(0, 2.01, 0.1))[1]
    print(f'sharpen amount {amount:.1f} (still energy {target:.0f})')

    motion = np.array([np.abs(gray(frames[j + 1], (336, 189)) - gray(frames[j], (336, 189))).mean() * 255
                       for j in range(len(frames) - 1)])

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

    add(write('closed', stills['closed'].astype(np.float32), 92), 0, 3, 'key')
    keys['closed'] = 0
    contact.append(('closed', stills['closed']))
    for name, a, b, lead, (first, last), count, tail in SEGMENTS:
        motion_drawings = pick_drawings(motion, first, last, count)
        drawings = lead + motion_drawings + tail
        print(name, 'drawings', drawings)
        for n, src in enumerate(drawings):
            t = (src - key_source[a]) / (key_source[b] - key_source[a])
            m = colour[a] * (1 - t) + colour[b] * t
            img = sharpen(apply_colour(register(frames[src], source_map, shape).astype(np.float32), m), amount)
            if src in lead:
                w = (len(lead) - lead.index(src)) / (len(lead) + 1)
                img = img * (1 - w) + stills[a].astype(np.float32) * w
            if src in tail:
                w = (tail.index(src) + 1) / (len(tail) + 1)
                img = img * (1 - w) + stills[b].astype(np.float32) * w
            file = write(f'{name}-{src:03d}', img, 80)
            # Ease out on the settling drawings: hold them a tick longer.
            ticks = 3 if n >= len(drawings) - len(tail) - 1 else 2
            add(file, src, ticks, 'drawing')
            contact.append((f'{src}', img))
        add(write(b, stills[b].astype(np.float32), 92), key_source[b], 3, 'key')
        keys[b] = len(sheet_frames) - 1
        contact.append((b, stills[b]))

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
