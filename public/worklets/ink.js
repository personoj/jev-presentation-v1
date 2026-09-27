/* Hand-inked strokes and deckled paper for the stop-motion design system.
 *
 * CSS Paint API worklet. Shapes are seeded by the element size plus --ink-seed, so each
 * element gets its own stable hand. --ink-boil (animated in steps) redraws the same shape
 * with a neighbouring seed, which is the "line boil" of hand-drawn animation.
 * --ink-progress draws the stroke on; CSS animates it in steps, never smoothly.
 */
const TAU = Math.PI * 2;

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const text = (props, name, fallback) => {
  const value = props.get(name);
  const out = value == null ? '' : String(value).trim();
  return out || fallback;
};
const number = (props, name, fallback) => {
  const out = parseFloat(text(props, name, ''));
  return Number.isFinite(out) ? out : fallback;
};
const seedOf = (size, props) =>
  Math.round(size.width) * 73856093 ^ Math.round(size.height) * 19349663 ^ number(props, '--ink-seed', 0) * 83492791;

/** A few low-frequency sines: the slow drift of a hand, not jitter. */
function drift(rand, amplitude) {
  const waves = [0, 1, 2].map(i => ({
    a: (rand() * 2 - 1) * amplitude / (i + 1),
    f: 0.5 + i * (1 + rand()),
    p: rand() * TAU,
  }));
  return t => waves.reduce((sum, w) => sum + w.a * Math.sin(TAU * w.f * t + w.p), 0);
}

/** Pressure profile: quick attack, long body, soft lift-off. */
function pressure(rand, width, taper = 1) {
  const pulse = drift(rand, 0.18);
  return t => {
    const attack = Math.min(1, t / 0.07), release = Math.min(1, (1 - t) / 0.16);
    const shape = 1 - taper + taper * Math.pow(Math.min(attack, release), 0.55);
    return Math.max(0.25, width * (0.3 + 0.7 * shape) * (1 + pulse(t)));
  };
}

/** Fill a variable-width stroke along a centre polyline, up to `progress` of its length. */
function stroke(ctx, points, widthAt, progress = 1) {
  if (points.length < 2 || progress <= 0) return;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = lengths[lengths.length - 1] || 1, limit = total * Math.min(1, progress);
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    let p = points[i], at = lengths[i], last = false;
    if (at > limit) {
      const f = (limit - lengths[i - 1]) / (at - lengths[i - 1] || 1);
      const q = points[i - 1];
      p = [q[0] + (p[0] - q[0]) * f, q[1] + (p[1] - q[1]) * f];
      at = limit; last = true;
    }
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const half = widthAt(at / total) / 2;
    left.push([p[0] - ty * half, p[1] + tx * half]);
    right.push([p[0] + ty * half, p[1] - tx * half]);
    if (last) break;
  }
  if (left.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** A hand-ruled line: slight bow, slow drift, small overshoot at both ends. */
function line(rand, x0, y0, x1, y1, rough, overshoot = 1) {
  const length = Math.hypot(x1 - x0, y1 - y0) || 1;
  const dx = (x1 - x0) / length, dy = (y1 - y0) / length, nx = -dy, ny = dx;
  const start = -(0.3 + rand() * 0.9) * rough * overshoot, end = length + (0.4 + rand() * 1.4) * rough * overshoot;
  const bow = (rand() * 2 - 1) * rough * Math.min(1.4, length / 220);
  const wander = drift(rand, rough * 0.45);
  const steps = Math.max(8, Math.ceil((end - start) / 5));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s = start + (end - start) * t;
    const off = bow * Math.sin(Math.PI * t) + wander(t) * Math.min(1, length / 80);
    points.push([x0 + dx * s + nx * off, y0 + dy * s + ny * off]);
  }
  return points;
}

function ellipse(rand, cx, cy, rx, ry, rough) {
  const start = -Math.PI * (0.55 + rand() * 0.35), sweep = TAU * (1.06 + rand() * 0.08);
  const warp = drift(rand, 0.035), tilt = (rand() * 2 - 1) * 0.06;
  const steps = Math.max(28, Math.ceil((rx + ry) * 0.9));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = start + sweep * t;
    const grow = 1 + 0.045 * t + warp(t) + (rand() - 0.5) * 0.004 * rough;
    const x = Math.cos(a) * rx * grow, y = Math.sin(a) * ry * grow;
    points.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return points;
}

/** Run strokes one after another, sharing a single draw-on progress by length. */
function drawSequence(ctx, strokes, progress) {
  const lengths = strokes.map(({points}) => {
    let sum = 0;
    for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    return sum;
  });
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let budget = total * progress;
  strokes.forEach((item, i) => {
    if (budget <= 0) return;
    const part = Math.min(1, budget / (lengths[i] || 1));
    budget -= lengths[i];
    ctx.globalAlpha = item.alpha ?? 1;
    stroke(ctx, item.points, item.width, part);
  });
  ctx.globalAlpha = 1;
}

registerPaint('ink', class {
  static get inputProperties() {
    return ['--ink-shape', '--ink-color', '--ink-width', '--ink-rough', '--ink-seed', '--ink-boil',
      '--ink-progress', '--ink-inset', '--ink-hatch', '--ink-angle'];
  }
  paint(ctx, size, props) {
    const shape = text(props, '--ink-shape', 'box');
    const width = number(props, '--ink-width', 1.5), rough = number(props, '--ink-rough', 1.2);
    const progress = Math.max(0, Math.min(1, number(props, '--ink-progress', 1)));
    const inset = number(props, '--ink-inset', Math.max(2, width + rough * 1.5));
    const rand = random(seedOf(size, props) + number(props, '--ink-boil', 0) * 7919);
    const w = size.width, h = size.height;
    if (w < 2 || h < 2 || progress <= 0) return;
    ctx.fillStyle = text(props, '--ink-color', '#27241f');
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    const jitter = () => (rand() * 2 - 1) * rough * 0.9;
    const strokes = [];
    const add = (points, strokeWidth = width, alpha = 1, taper = 1) =>
      strokes.push({points, width: pressure(rand, strokeWidth, taper), alpha});

    if (shape === 'box' || shape === 'box2' || shape === 'dash') {
      const passes = shape === 'box2' ? 2 : 1;
      for (let pass = 0; pass < passes; pass++) {
        const c = [[x0 + jitter(), y0 + jitter()], [x1 + jitter(), y0 + jitter()], [x1 + jitter(), y1 + jitter()], [x0 + jitter(), y1 + jitter()]];
        const alpha = pass ? 0.55 : 1, strokeWidth = pass ? width * 0.7 : width;
        for (let i = 0; i < 4; i++) {
          const a = c[i], b = c[(i + 1) % 4];
          if (shape === 'dash') {
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dashes = Math.max(1, Math.round(len / 14));
            for (let d = 0; d < dashes; d++) {
              const f0 = d / dashes, f1 = f0 + 0.55 / dashes;
              add(line(rand, a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1, rough * 0.4, 0.2), strokeWidth, alpha);
            }
          } else add(line(rand, a[0], a[1], b[0], b[1], rough), strokeWidth, alpha);
        }
      }
    } else if (shape === 'underline' || shape === 'underline2') {
      const y = y1 - width / 2, rise = rough * 1.6;
      const base = line(rand, x0, y + rise * 0.4, x1, y - rise * 0.6, rough * 0.8, 1.5);
      add(base, width, 1);
      if (shape === 'underline2') {
        const x2 = x0 + (x1 - x0) * (0.12 + rand() * 0.08);
        add(line(rand, x2, y + width * 1.6, x1 - (x1 - x0) * 0.06, y + width * 1.2, rough * 0.8, 1), width * 0.7, 0.9);
      }
    } else if (shape === 'rule') {
      add(line(rand, x0, h / 2, x1, h / 2 + jitter(), rough, 0.6), width, 1, 0.6);
    } else if (shape === 'vrule') {
      add(line(rand, w / 2, y0, w / 2 + jitter(), y1, rough, 0.6), width, 1, 0.6);
    } else if (shape === 'ring') {
      add(ellipse(rand, w / 2, h / 2, w / 2 - inset, h / 2 - inset, rough), width, 1);
    } else if (shape === 'marker') {
      const band = Math.max(4, h - inset * 2);
      add(line(rand, x0, h / 2 + band * 0.08, x1, h / 2 - band * 0.06, rough * 0.6, 0.4), band, 1, 0.35);
    } else if (shape === 'hatch') {
      const gap = number(props, '--ink-hatch', 7), angle = number(props, '--ink-angle', 58) * Math.PI / 180;
      const tan = Math.tan(angle), run = (y1 - y0) / tan;
      for (let x = x0 - run; x < x1; x += gap * (0.85 + rand() * 0.3)) {
        let ax = x, ay = y1, bx = x + run, by = y0;
        if (ax < x0) { ay = y1 - (x0 - ax) * tan; ax = x0; }
        if (bx > x1) { by = y0 + (bx - x1) * tan; bx = x1; }
        if (Math.hypot(bx - ax, by - ay) < 3) continue;
        add(line(rand, ax, ay, bx, by, rough * 0.35, 0.15), width, 0.85, 0.5);
      }
    } else if (shape === 'check') {
      add([[x0, h * 0.55], [x0 + (x1 - x0) * 0.38, y1], [x1, y0]].flatMap((p, i, all) => {
        if (!i) return [];
        return line(rand, all[i - 1][0], all[i - 1][1], p[0], p[1], rough * 0.5, 0.3);
      }), width, 1);
    } else if (shape === 'cross') {
      add(line(rand, x0, y0, x1, y1, rough * 0.6, 0.6), width, 1);
      add(line(rand, x1, y0, x0, y1, rough * 0.6, 0.6), width, 1);
    } else if (shape === 'arrow' || shape === 'arrow-down') {
      const down = shape === 'arrow-down';
      const [ax, ay, bx, by] = down ? [w / 2, y0, w / 2, y1] : [x0, h / 2, x1, h / 2];
      add(line(rand, ax, ay, bx, by, rough, 0.3), width, 1);
      const head = Math.min(12, (down ? h : w) * 0.3);
      const tip = down ? [bx + jitter() * 0.4, by] : [bx, by + jitter() * 0.4];
      const wings = down ? [[tip[0] - head * 0.6, tip[1] - head], [tip[0] + head * 0.6, tip[1] - head]]
        : [[tip[0] - head, tip[1] - head * 0.6], [tip[0] - head, tip[1] + head * 0.6]];
      for (const wing of wings) add(line(rand, wing[0], wing[1], tip[0], tip[1], rough * 0.3, 0.2), width, 1);
    }
    drawSequence(ctx, strokes, progress);
  }
});

/* Deckled or torn paper, used as a mask. --deckle is the edge amplitude in px.
 * --deckle-mode: sheet (all edges) | tape (straight long edges, torn short ends). */
registerPaint('deckle', class {
  static get inputProperties() { return ['--deckle', '--deckle-mode', '--ink-seed']; }
  paint(ctx, size, props) {
    const amp = number(props, '--deckle', 2.2), mode = text(props, '--deckle-mode', 'sheet');
    const rand = random(seedOf(size, props) + 17);
    const w = size.width, h = size.height, pad = amp + 0.5;
    const edge = (length, rough) => {
      const slow = drift(rand, rough * 0.55), out = [];
      const steps = Math.max(4, Math.ceil(length / 3));
      for (let i = 0; i <= steps; i++) out.push(slow(i / steps) + (rand() - 0.5) * rough * 0.9);
      return out;
    };
    const tapeEnds = mode === 'tape';
    const top = edge(w, tapeEnds ? 0.25 : amp), right = edge(h, amp * (tapeEnds ? 1.8 : 1));
    const bottom = edge(w, tapeEnds ? 0.25 : amp), left = edge(h, amp * (tapeEnds ? 1.8 : 1));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    top.forEach((o, i) => { const x = i / (top.length - 1) * w; i ? ctx.lineTo(x, pad + o) : ctx.moveTo(x, pad + o); });
    right.forEach((o, i) => ctx.lineTo(w - pad - o, i / (right.length - 1) * h));
    bottom.forEach((o, i) => ctx.lineTo(w - i / (bottom.length - 1) * w, h - pad - o));
    left.forEach((o, i) => ctx.lineTo(pad + o, h - i / (left.length - 1) * h));
    ctx.closePath();
    ctx.fill();
  }
});
