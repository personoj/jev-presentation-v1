import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {backingSize, exposureMs, keepDecoded, pickSize, plan, readSheet, type BookKey, type Exposure, type FlipSheet} from './flipbook';

const BASE = '/media/book-flip';
const still = (key: BookKey) => `${BASE}/desktop/${key}.webp`;
const TRAIL = 6;

// Module level: survives remounts, so returning to the book never refetches.
let sheetRequest: Promise<FlipSheet> | null = null;
const blobs = new Map<string, Promise<Blob>>();
function loadSheet() {
 if (!sheetRequest) {
  sheetRequest = fetch(`${BASE}/sheet.json`).then(r => {
   if (!r.ok) throw new Error(`book sheet ${r.status}`);
   return r.json();
  }).then(readSheet);
  sheetRequest.catch(() => {sheetRequest = null});
 }
 return sheetRequest;
}
function loadBlob(url: string) {
 let request = blobs.get(url);
 if (!request) {
  request = fetch(url).then(r => {
   if (!r.ok) throw new Error(`${url} ${r.status}`);
   return r.blob();
  });
  request.catch(() => blobs.delete(url));
  blobs.set(url, request);
 }
 return request;
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

type Events = {arrive: (key: BookKey) => void; ready: () => void; error: () => void};

/**
 * Plays the exposure sheet on a canvas. Drawings replace each other with hard cuts on the
 * sheet clock; nothing is blended live. Frames are decoded ahead at the exact device size
 * of the canvas, and if a decode is late the current drawing is held, never skipped.
 */
class Player {
 private readonly ctx: CanvasRenderingContext2D | null;
 private sheet: FlipSheet | null = null;
 private size = '';
 private device = {width: 0, height: 0};
 private bitmaps = new Map<number, ImageBitmap>();
 private decoding = new Map<number, Promise<void>>();
 private generation = 0;
 private shown = -1;
 private queue: Exposure[] = [];
 private trail: number[] = [];
 private dueAt = 0;
 private raf = 0;
 private jump = 0;
 private sized = false;
 private drawn = false;
 private prefetching = false;
 private destroyed = false;

 constructor(private readonly canvas: HTMLCanvasElement, private target: BookKey, private readonly events: Events) {
  this.ctx = canvas.getContext('2d');
 }

 async start() {
  try {
   this.sheet = await loadSheet();
  } catch {
   if (!this.destroyed) this.events.error();
   return;
  }
  if (!this.destroyed && this.device.width) this.applySize();
 }

 resize(width: number, height: number) {
  if (width < 2 || height < 2) return; // hidden: keep what we have
  if (width === this.device.width && height === this.device.height) return;
  this.device = {width, height};
  if (this.sheet) this.applySize();
 }

 setTarget(key: BookKey, instant: boolean) {
  const sheet = this.sheet;
  const settled = !this.queue.length && sheet && this.shown === sheet.keys[key];
  this.target = key;
  if (!sheet) return;
  if (settled) {
   this.events.arrive(key);
   return;
  }
  if (instant || reducedMotion() || this.shown < 0) {
   this.jumpTo(sheet.keys[key]);
   return;
  }
  this.jump++;
  this.queue = plan(sheet, this.shown, key);
  this.dueAt = performance.now();
  this.keepWindow();
  if (!this.raf) this.raf = requestAnimationFrame(() => this.frame());
 }

 destroy() {
  this.destroyed = true;
  cancelAnimationFrame(this.raf);
  this.bitmaps.forEach(bitmap => bitmap.close());
  this.bitmaps.clear();
 }

 private applySize() {
  const sheet = this.sheet!;
  const next = backingSize(sheet, this.device.width, this.device.height);
  if (!this.size || sheet.sizes[this.size] < next.width) this.size = pickSize(sheet, next.width);
  if (!this.prefetching) {
   this.prefetching = true;
   void this.prefetch();
  }
  if (this.sized && next.width === this.canvas.width && next.height === this.canvas.height) return;
  const current = this.bitmaps.get(this.shown), frame = this.shown;
  this.canvas.width = next.width;
  this.canvas.height = next.height;
  this.sized = true;
  this.generation++;
  // Keep the picture (scaled) while the drawings are re-decoded at the new size.
  if (current) this.draw(current);
  this.bitmaps.forEach(bitmap => bitmap.close());
  this.bitmaps.clear();
  this.decoding.clear();
  if (frame < 0) {
   this.jumpTo(sheet.keys[this.target]);
   return;
  }
  void this.decode(frame).then(() => {
   const bitmap = this.bitmaps.get(frame);
   if (bitmap && this.shown === frame) this.draw(bitmap);
  });
  this.keepWindow();
 }

 private url(frame: number) {
  return `${BASE}/${this.size}/${this.sheet!.frames[frame].file}`;
 }

 private decode(frame: number): Promise<void> {
  const pending = this.decoding.get(frame);
  if (pending) return pending;
  if (this.bitmaps.has(frame)) return Promise.resolve();
  const generation = this.generation, {width, height} = this.canvas;
  const request = loadBlob(this.url(frame))
   .then(blob => createImageBitmap(blob, {resizeWidth: width, resizeHeight: height, resizeQuality: 'high'}))
   .then(bitmap => {
    if (this.destroyed || generation !== this.generation) bitmap.close();
    else this.bitmaps.set(frame, bitmap);
   })
   .catch(() => {
    if (!this.destroyed && generation === this.generation) this.events.error();
   })
   .finally(() => {
    if (this.decoding.get(frame) === request) this.decoding.delete(frame);
   });
  this.decoding.set(frame, request);
  return request;
 }

 private keepWindow() {
  const sheet = this.sheet;
  if (!sheet || !this.sized) return;
  const keep = keepDecoded(sheet, this.shown, this.queue, this.trail);
  keep.forEach(frame => void this.decode(frame));
  this.bitmaps.forEach((bitmap, frame) => {
   if (keep.has(frame)) return;
   bitmap.close();
   this.bitmaps.delete(frame);
  });
 }

 private async prefetch() {
  const sheet = this.sheet!;
  const origin = sheet.keys[this.target];
  const order = sheet.frames.map((_, i) => i).sort((a, b) => Math.abs(a - origin) - Math.abs(b - origin));
  for (const frame of order) {
   if (this.destroyed || !this.size) return;
   await loadBlob(this.url(frame)).catch(() => undefined);
  }
 }

 private jumpTo(frame: number) {
  const token = ++this.jump;
  this.queue = [];
  cancelAnimationFrame(this.raf);
  this.raf = 0;
  const show = () => {
   const bitmap = this.bitmaps.get(frame);
   if (token !== this.jump || !bitmap) return;
   this.show(frame, bitmap);
   this.events.arrive(this.target);
  };
  if (this.bitmaps.has(frame)) show();
  else if (this.sized) void this.decode(frame).then(show);
 }

 private frame() {
  this.raf = 0;
  // Not the rAF timestamp: that is when the frame began, and after a long task (the scene
  // change itself) it lags the moment a drawing reaches the screen, squeezing the first exposures.
  const now = performance.now(), sheet = this.sheet, next = this.queue[0];
  if (!sheet || !next) return;
  if (now + 4 >= this.dueAt) {
   const bitmap = this.bitmaps.get(next.frame);
   if (bitmap) {
    this.show(next.frame, bitmap);
    this.queue.shift();
    const duration = exposureMs(sheet, next);
    // Keep the sheet's cadence; after a late decode, restart the clock rather than skip drawings.
    this.dueAt = (now - this.dueAt > duration ? now : this.dueAt) + duration;
    this.keepWindow();
    if (!this.queue.length) {
     this.events.arrive(this.target);
     return;
    }
   }
  }
  this.raf = requestAnimationFrame(() => this.frame());
 }

 private show(frame: number, bitmap: ImageBitmap) {
  if (this.shown >= 0 && this.shown !== frame) this.trail = [this.shown, ...this.trail.filter(f => f !== this.shown)].slice(0, TRAIL);
  this.shown = frame;
  this.draw(bitmap);
 }

 private draw(bitmap: ImageBitmap) {
  if (!this.ctx) return;
  this.ctx.imageSmoothingQuality = 'high';
  this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
  if (!this.drawn) {
   this.drawn = true;
   this.events.ready();
  }
 }
}

const LABELS: Record<BookKey, string> = {
 closed: '布面概念书《思考，快与慢》，合着放在桌上',
 open: '打开的原创导读：左页介绍两种思考方式，右页介绍 Jev',
 entered: '右页图解近景：上下文 → 问题 → 判断',
};

export function BookFlipbook({target, instant = false, onArrive}: {target: BookKey; instant?: boolean; onArrive?: (key: BookKey) => void}) {
 const canvas = useRef<HTMLCanvasElement>(null), player = useRef<Player | null>(null);
 const initial = useRef(target), arrive = useRef(onArrive);
 const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
 arrive.current = onArrive;
 useEffect(() => {
  const element = canvas.current;
  if (!element || typeof createImageBitmap !== 'function' || typeof ResizeObserver !== 'function') {
   setFailed(true);
   return;
  }
  const instance = new Player(element, initial.current, {
   arrive: key => arrive.current?.(key),
   ready: () => setReady(true),
   error: () => setFailed(true),
  });
  player.current = instance;
  const observer = new ResizeObserver(([entry]) => {
   const device = entry.devicePixelContentBoxSize?.[0];
   if (device) instance.resize(device.inlineSize, device.blockSize);
   else instance.resize(Math.round(entry.contentRect.width * devicePixelRatio), Math.round(entry.contentRect.height * devicePixelRatio));
  });
  try {
   observer.observe(element, {box: 'device-pixel-content-box'});
  } catch {
   observer.observe(element);
  }
  void instance.start();
  return () => {
   observer.disconnect();
   instance.destroy();
   player.current = null;
  };
 }, []);
 // Before paint: a cut to a key draws synchronously (keys stay decoded), so a scene that
 // becomes visible never shows the drawing it was left on for a frame.
 useLayoutEffect(() => {
  player.current?.setTarget(target, instant);
  if (failed) arrive.current?.(target);
 }, [target, instant, failed]);
 return <div className="flipbook" data-ready={ready && !failed ? '' : undefined}>
  {failed
   ? <img className="flipbook-still" src={still(target)} alt={LABELS[target]}/>
   : <>
    {!ready && <img className="flipbook-still" src={still(initial.current)} alt=""/>}
    <canvas ref={canvas} role="img" aria-label={LABELS[target]}/>
   </>}
 </div>;
}
