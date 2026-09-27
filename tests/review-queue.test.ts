import test from 'node:test';
import assert from 'node:assert/strict';
import {LatestReviewQueue} from '../src/features/alignment/review-queue.ts';
import {findShortPreview,findCandidate} from '../src/features/alignment/engine.ts';
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
const job=(key:string,apply=(value:string)=>{},fail=(error:unknown)=>{})=>({key,value:key,apply,fail});

test('continuous revisions retain one active request and only the latest pending input',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const calls:string[]=[],resolvers:((v:string)=>void)[]=[],signals:AbortSignal[]=[];
 const queue=new LatestReviewQueue<string,string>((v,s)=>{calls.push(v);signals.push(s);return new Promise(r=>resolvers.push(r))});t.after(()=>queue.cancel());
 queue.enqueue(job('a'));await flush();queue.enqueue(job('b'));queue.enqueue(job('c'));
 assert.deepEqual(calls,['a']);assert.equal(signals[0].aborted,false);
 resolvers[0]('a');await flush();t.mock.timers.tick(200);queue.enqueue(job('d'));t.mock.timers.tick(50);await flush();
 assert.deepEqual(calls,['a','d'],'new input must not postpone the existing launch deadline');
});
test('a final revision with the same text reuses the active request and newest callback',async t=>{
 let resolve!:(v:string)=>void;const applied:string[]=[];
 const queue=new LatestReviewQueue<string,string>(()=>new Promise(r=>resolve=r));t.after(()=>queue.cancel());
 queue.enqueue(job('same',()=>applied.push('partial')));await flush();
 queue.enqueue(job('same',()=>applied.push('final')));resolve('answer');await flush();assert.deepEqual(applied,['final']);
});
test('cancellation suppresses late results; timeout releases a provider that ignores abort',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const calls:string[]=[],applied:string[]=[],errors:unknown[]=[];let resolve!:(v:string)=>void;
 const queue=new LatestReviewQueue<string,string>(v=>{calls.push(v);return new Promise(r=>resolve=r)},0,100);t.after(()=>queue.cancel());
 queue.enqueue(job('old',v=>applied.push(v)));await flush();const oldResolve=resolve;queue.cancel();oldResolve('stale');await flush();assert.deepEqual(applied,[]);
 queue.enqueue(job('hung',()=>{},e=>errors.push(e)));await flush();queue.enqueue(job('latest'));t.mock.timers.tick(100);await flush();
 assert.equal(errors.length,1);assert.deepEqual(calls,['old','hung','latest']);
});
test('short preview stays at the reading head and does not jump to incidental words',()=>{
 assert.equal(findShortPreview('我们使用模型。然后继续。','我们',0)?.end,2);
 assert.equal(findShortPreview('我们使用模型。然后继续。','然后',0),null);
 assert.equal(findShortPreview('我们使用模型。然后继续。','我',0),null);
 assert.equal(findShortPreview('我们使用模型。然后继续。','然后',7)?.end,9);
 assert.equal(findCandidate('我们使用模型。','我们使用',0)?.exact,true);
});
