import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {BOOK_KEYS, REVERSE_KEY_TICKS, REVERSE_TICKS, backingSize, exposureMs, keepDecoded, pickSize, plan, readSheet} from '../src/components/flipbook';

const raw = JSON.parse(readFileSync(new URL('../public/media/book-flip/sheet.json', import.meta.url), 'utf8'));
const sheet = readSheet(raw);

test('the shipped exposure sheet is valid and every drawing exists at every size', () => {
 for (const size of Object.keys(sheet.sizes))
  for (const frame of sheet.frames)
   assert.ok(existsSync(new URL(`../public/media/book-flip/${size}/${frame.file}`, import.meta.url)), `${size}/${frame.file}`);
 assert.deepEqual(BOOK_KEYS.map(key => sheet.frames[sheet.keys[key]].kind), ['key', 'key', 'key']);
});

test('forward travel exposes every drawing once and lands on the key with its own timing', () => {
 const steps = plan(sheet, sheet.keys.closed, 'open');
 assert.equal(steps.length, sheet.keys.open - sheet.keys.closed);
 assert.deepEqual(steps.map(step => step.frame), Array.from({length: steps.length}, (_, i) => sheet.keys.closed + 1 + i));
 assert.equal(steps.at(-1)!.frame, sheet.keys.open);
 steps.forEach(step => assert.equal(step.ticks, sheet.frames[step.frame].ticks));
 const seconds = steps.reduce((sum, step) => sum + exposureMs(sheet, step), 0) / 1000;
 assert.ok(seconds > 1.5 && seconds < 3.5, `closed→open lasts ${seconds}s`);
});

test('reverse travel reuses the same drawings backwards, on ones, and never overshoots', () => {
 const steps = plan(sheet, sheet.keys.entered, 'open');
 assert.deepEqual(steps.map(step => step.frame), Array.from({length: sheet.keys.entered - sheet.keys.open}, (_, i) => sheet.keys.entered - 1 - i));
 assert.ok(steps.slice(0, -1).every(step => step.ticks === REVERSE_TICKS));
 assert.equal(steps.at(-1)!.ticks, REVERSE_KEY_TICKS);
});

test('a reversal mid-flight starts from the drawing on screen', () => {
 const midway = sheet.keys.open + 9;
 assert.deepEqual(plan(sheet, midway, 'open').map(step => step.frame), Array.from({length: 9}, (_, i) => midway - 1 - i));
 assert.equal(plan(sheet, midway, 'entered')[0].frame, midway + 1);
 assert.deepEqual(plan(sheet, sheet.keys.open, 'open'), []);
});

test('encoded size and canvas backing follow device pixels without upscaling the drawings', () => {
 assert.equal(pickSize(sheet, 700), 'mobile');
 assert.equal(pickSize(sheet, 1000), 'desktop');
 assert.equal(pickSize(sheet, 4000), 'desktop');
 assert.deepEqual(backingSize(sheet, 1000, 563), {width: 1000, height: 563});
 assert.deepEqual(backingSize(sheet, 2100, 1182), {width: sheet.width, height: Math.round(1182 * sheet.width / 2100)});
});

test('decode window keeps keys, the frame on screen, the next drawings and a short trail', () => {
 const queue = plan(sheet, sheet.keys.closed, 'open');
 const keep = keepDecoded(sheet, 3, queue.slice(3), [2, 1], 4);
 for (const key of BOOK_KEYS) assert.ok(keep.has(sheet.keys[key]));
 assert.deepEqual([...keep].filter(frame => !BOOK_KEYS.some(key => sheet.keys[key] === frame)).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
});

test('malformed sheets are rejected before any drawing is fetched', () => {
 assert.throws(() => readSheet({...raw, version: 2}), /version/);
 assert.throws(() => readSheet({...raw, keys: {...raw.keys, open: 1}}), /key open/);
 assert.throws(() => readSheet({...raw, frames: raw.frames.map((frame: object, i: number) => i ? frame : {...frame, file: '../x.webp'})}), /file/);
});
