/** Exposure-sheet logic for the stop-motion book. Pure, so it can be tested without a browser. */
export type BookKey = 'closed' | 'open' | 'entered';
export type FlipFrame = {file: string; source: number | null; ticks: number; kind: 'key' | 'drawing'};
export type FlipSheet = {
 version: 1; ticksPerSecond: number; width: number; height: number;
 sizes: Record<string, number>; keys: Record<BookKey, number>; frames: FlipFrame[];
};
/** One drawing on screen for `ticks` ticks of the sheet clock. */
export type Exposure = {frame: number; ticks: number};

export const BOOK_KEYS: BookKey[] = ['closed', 'open', 'entered'];
/** Going back runs on ones: it should read as the animator scrubbing back, not a slow replay. */
export const REVERSE_TICKS = 1;
export const REVERSE_KEY_TICKS = 2;

export function readSheet(value: unknown): FlipSheet {
 const sheet = value as FlipSheet;
 const fail = (why: string): never => {throw new Error(`book sheet: ${why}`)};
 if (!sheet || sheet.version !== 1) fail('unsupported version');
 if (!(sheet.ticksPerSecond > 0) || !(sheet.width > 0) || !(sheet.height > 0)) fail('bad clock or size');
 if (!Array.isArray(sheet.frames) || !sheet.frames.length) fail('no frames');
 sheet.frames.forEach((frame, i) => {
  if (typeof frame?.file !== 'string' || !/^[\w-]+\.webp$/.test(frame.file)) fail(`frame ${i} file`);
  if (!Number.isInteger(frame.ticks) || frame.ticks < 1) fail(`frame ${i} ticks`);
 });
 let last = -1;
 for (const key of BOOK_KEYS) {
  const at = sheet.keys?.[key];
  if (!Number.isInteger(at) || at <= last || at >= sheet.frames.length || sheet.frames[at].kind !== 'key') fail(`key ${key}`);
  last = at;
 }
 if (!sheet.sizes || !Object.values(sheet.sizes).every(width => width > 0)) fail('sizes');
 return sheet;
}

/** Drawings to expose, in order, to travel from the frame on screen to a key. */
export function plan(sheet: FlipSheet, from: number, to: BookKey): Exposure[] {
 const target = sheet.keys[to];
 const out: Exposure[] = [];
 if (target > from) for (let i = from + 1; i <= target; i++) out.push({frame: i, ticks: sheet.frames[i].ticks});
 else for (let i = from - 1; i >= target; i--) out.push({frame: i, ticks: i === target ? REVERSE_KEY_TICKS : REVERSE_TICKS});
 return out;
}

export function exposureMs(sheet: FlipSheet, exposure: Exposure) {
 return exposure.ticks * 1000 / sheet.ticksPerSecond;
}

/** Smallest encoded size that covers the canvas in device pixels: drawings are only ever scaled down. */
export function pickSize(sheet: FlipSheet, devicePixels: number) {
 const sizes = Object.entries(sheet.sizes).sort((a, b) => a[1] - b[1]);
 return (sizes.find(([, width]) => width >= devicePixels) ?? sizes[sizes.length - 1])[0];
}

/**
 * Canvas backing size: exactly the device-pixel box the canvas is shown at, so each drawing is
 * blitted 1:1. Only when the box is larger than the drawings is it capped (and scaled by CSS).
 */
export function backingSize(sheet: FlipSheet, deviceWidth: number, deviceHeight: number) {
 const scale = Math.min(1, sheet.width / deviceWidth);
 return {width: Math.max(1, Math.round(deviceWidth * scale)), height: Math.max(1, Math.round(deviceHeight * scale))};
}

/**
 * Frames worth keeping decoded: every key (instant jumps), what is on screen, the next
 * drawings in the queue and a few just shown (so an immediate reversal does not wait).
 */
export function keepDecoded(sheet: FlipSheet, shown: number, queue: Exposure[], trail: number[], ahead = 8) {
 const keep = new Set<number>(BOOK_KEYS.map(key => sheet.keys[key]));
 if (shown >= 0) keep.add(shown);
 queue.slice(0, ahead).forEach(step => keep.add(step.frame));
 trail.forEach(frame => keep.add(frame));
 return keep;
}
