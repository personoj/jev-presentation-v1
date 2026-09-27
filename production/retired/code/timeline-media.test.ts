import test from 'node:test';
import assert from 'node:assert/strict';
import {observeMediaReadiness, runTimelinePlayback} from '../src/components/TimelineMedia';

class ReadinessMedia extends EventTarget {readyState = 0;}
test('cached metadata is observed immediately without a future loadedmetadata event', () => {
  const media = new ReadinessMedia(); media.readyState = 4; const states: boolean[] = [];
  const stop = observeMediaReadiness(media, ready => states.push(ready));
  assert.deepEqual(states, [true]); stop();
});
test('canplay recovers a missed metadata event and a new load invalidates readiness', () => {
  const media = new ReadinessMedia(), states: boolean[] = [];
  const stop = observeMediaReadiness(media, ready => states.push(ready));
  media.readyState = 4; media.dispatchEvent(new Event('canplay'));
  media.readyState = 0; media.dispatchEvent(new Event('emptied'));
  assert.deepEqual(states, [false, true, false]); stop();
});
test('StrictMode cleanup unsubscribes listeners and remount reads current readiness', () => {
  const media = new ReadinessMedia(), old: boolean[] = [], current: boolean[] = [];
  const stop = observeMediaReadiness(media, value => old.push(value)); stop();
  media.readyState = 4;
  const stopCurrent = observeMediaReadiness(media, value => current.push(value));
  media.dispatchEvent(new Event('loadeddata'));
  assert.deepEqual(old, [false]); assert.deepEqual(current, [true, true]); stopCurrent();
});
function fixture(initial=0) {
  let serial=0, now=0, playCount=0, arrived=0, errors=0;
  const queued=new Map<number, FrameRequestCallback>(), every=new Map<number, FrameRequestCallback>(), playing: boolean[]=[];
  const media={currentTime:initial,playbackRate:1,pause(){},play(){playCount++;return Promise.resolve();}};
  const scheduler={request(fn:FrameRequestCallback){const id=++serial;queued.set(id,fn);every.set(id,fn);return id;},cancel(id:number){queued.delete(id);},now:()=>now};
  const options={hold:5.125,fps:24,speed:1,reduced:false,onPlaying:(v:boolean)=>playing.push(v),onArrive:()=>arrived++,onError:()=>errors++};
  return {media,scheduler,options,playing,queued,every,counts:()=>({playCount,arrived,errors}),advance(value:number){now=value;const calls=[...queued.values()];queued.clear();for(const call of calls)call(now);}};
}
test('forward playback starts and stops at the exact timeline hold once', () => {
  const f=fixture();runTimelinePlayback(f.media,f.options,f.scheduler);
  assert.equal(f.counts().playCount,1);f.media.currentTime=5.12;f.advance(5100);
  assert.equal(f.media.currentTime,5.125);assert.equal(f.counts().arrived,1);
  for(const callback of f.every.values())callback(6000);
  assert.equal(f.counts().arrived,1);assert.equal(f.media.currentTime,5.125);
});
test('cancelled pending play rejection cannot fail its replacement run', async () => {
  const f=fixture();let reject!: (error:Error)=>void;
  f.media.play=()=>new Promise<void>((_,no)=>{reject=no;});
  const cancel=runTimelinePlayback(f.media,f.options,f.scheduler);cancel();
  f.media.play=()=>Promise.resolve();runTimelinePlayback(f.media,f.options,f.scheduler);
  reject(new Error('AbortError'));await Promise.resolve();await Promise.resolve();
  assert.equal(f.counts().errors,0);assert.ok(f.queued.size>0);
});
test('replay cancellation prevents an old queued frame from restoring the previous hold', () => {
  const f=fixture();const cancel=runTimelinePlayback(f.media,f.options,f.scheduler);
  const stale=[...f.every.values()][0];cancel();f.media.currentTime=0;
  runTimelinePlayback(f.media,f.options,f.scheduler);stale(6000);
  assert.equal(f.media.currentTime,0);assert.equal(f.counts().arrived,0);
});
test('reverse and reduced motion use timeline hold instead of media duration', () => {
  const f=fixture(5.125);runTimelinePlayback(f.media,{...f.options,hold:0},f.scheduler);f.advance(6000);
  assert.equal(f.media.currentTime,0);assert.equal(f.counts().arrived,1);
  const reduced=fixture();runTimelinePlayback(reduced.media,{...reduced.options,reduced:true},reduced.scheduler);
  assert.equal(reduced.media.currentTime,5.125);assert.equal(reduced.counts().playCount,0);assert.equal(reduced.counts().arrived,1);
});
