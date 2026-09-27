"""Generate the seamless paper-grain overlay used across the presentation.

The tile is an RGBA overlay rather than a coloured paper: warm-brown specks and
fibres darken, pale fibres lighten, so the same texture sits on the page, the
cards and the book mat. Everything is periodic (FFT noise, fibres drawn with
wrap-around), so it tiles without seams.

Run from the project root:  python production/paper/make_paper.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/art/paper-grain.webp'
SIZE = 512
rng = np.random.default_rng(20260926)


def periodic_noise(power: float, low: float = 0.0, high: float = 1.0) -> np.ndarray:
    """White noise shaped in the frequency domain; periodic on the tile by construction."""
    f = np.fft.fftfreq(SIZE)
    radius = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2)
    radius[0, 0] = 1
    band = (radius >= low / SIZE) & (radius <= high)
    spectrum = np.fft.fft2(rng.standard_normal((SIZE, SIZE))) * band / radius ** power
    out = np.real(np.fft.ifft2(spectrum))
    return (out - out.mean()) / out.std()


def fibres(count: int, length: tuple[int, int], width: float, value: float) -> np.ndarray:
    """Short curved fibres drawn on a 3x3 canvas and folded back, so they wrap."""
    scale = 2
    canvas = Image.new('F', (SIZE * 3 * scale, SIZE * 3 * scale), 0.0)
    draw = ImageDraw.Draw(canvas)
    for _ in range(count):
        x, y = rng.uniform(SIZE, 2 * SIZE, 2)
        angle, bend = rng.uniform(0, np.pi), rng.normal(0, 0.035)
        steps = int(rng.integers(*length))
        points = []
        for _ in range(steps):
            points.append((x * scale, y * scale))
            angle += bend + rng.normal(0, 0.05)
            x, y = x + np.cos(angle), y + np.sin(angle)
        strength = value * rng.uniform(0.35, 1.0)
        draw.line(points, fill=strength, width=max(1, round(width * scale * rng.uniform(0.6, 1.3))))
    big = np.asarray(canvas.resize((SIZE * 3, SIZE * 3), Image.BOX), dtype=np.float32)
    folded = np.zeros((SIZE, SIZE), dtype=np.float32)
    for i in range(3):
        for j in range(3):
            folded += big[i * SIZE:(i + 1) * SIZE, j * SIZE:(j + 1) * SIZE]
    return folded


def main() -> None:
    mottle = periodic_noise(1.6, low=1.5, high=0.06)       # large soft clouds in the pulp
    tooth = periodic_noise(0.35, low=40, high=0.5)          # the fine tooth of cold-press paper
    speck = np.clip(periodic_noise(0.0, low=120) - 2.9, 0, None)  # rare dark inclusions
    dark_fibres = fibres(520, (8, 34), 0.8, 1.0)
    light_fibres = fibres(380, (10, 42), 1.0, 1.0)

    # Mottle is added after thresholding, as a faint even wash; used as a threshold it
    # would cluster the tooth into visible, repeating clouds.
    darkness = 0.05 * tooth + 0.5 * speck + 0.16 * dark_fibres - 0.2 * light_fibres
    darkness -= np.median(darkness)
    dark = np.clip(darkness, 0, None) + 0.006 * np.clip(mottle + 1, 0, None)
    light = np.clip(-darkness, 0, None)

    rgba = np.zeros((SIZE, SIZE, 4), dtype=np.float32)
    ink = np.array([84, 64, 38], dtype=np.float32)       # warm sepia for shadows in the pulp
    pale = np.array([255, 253, 246], dtype=np.float32)
    dark_alpha = np.clip(dark * 1.6, 0, 0.34)
    light_alpha = np.clip(light * 2.2, 0, 0.5)
    total = dark_alpha + light_alpha + 1e-6
    rgba[..., :3] = (ink * dark_alpha[..., None] + pale * light_alpha[..., None]) / total[..., None]
    rgba[..., 3] = np.clip(dark_alpha + light_alpha, 0, 1) * 255
    image = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
    image.save(OUT, 'WEBP', quality=76, method=6)
    print(OUT.relative_to(ROOT), OUT.stat().st_size // 1024, 'KB', 'mean alpha', round(float(rgba[..., 3].mean() / 255), 3))

    # Preview on the page colour, tiled 2x2, to check seams by eye.
    paper = Image.new('RGBA', (SIZE * 2, SIZE * 2), (244, 239, 228, 255))
    for i in range(2):
        for j in range(2):
            paper.alpha_composite(image, (i * SIZE, j * SIZE))
    paper.convert('RGB').save(ROOT / '.local/paper-preview.png')


if __name__ == '__main__':
    main()
