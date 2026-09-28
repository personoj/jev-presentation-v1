import test from 'node:test';
import assert from 'node:assert/strict';
import {FollowReviewWindow,canResumeNearby,recentFollowSpeech} from '../src/features/alignment/follow-review';
import {Teleprompter,FollowGate} from '../src/features/alignment/teleprompter';
import {LatestReviewQueue} from '../src/features/alignment/review-queue';

const script='接下来，我用跟读场景演示这套流程。\n我按稿件朗读，标记就跟随我的位置。\n如果我临时补充几句话，标记会停住。';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};

test('continuous ASR no longer starves a slower gate verdict, and only the latest cursor commits',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const tracker=new Teleprompter(),gate=new FollowGate(),window=new FollowReviewWindow();
 const accepted:number[]=[],positions:number[]=[];
 const queue=new LatestReviewQueue<number,number>(v=>new Promise(resolve=>setTimeout(()=>resolve(v),350)));
 t.after(()=>queue.cancel());
 let first:any;
 for(const [i,text] of ['接下来','接下来我','接下来我用','接下来我用跟读','接下来我用跟读场景'].entries()){
  const u=tracker.propose(script,text,false,'a')!;first??=u;
  const observation=window.observe(u,script,tracker.position);
  if(observation.changed)queue.cancel();
  if(gate.mayTrack(u))tracker.commit(u);
  queue.enqueue({key:text,value:i,apply:()=>{
   const latest=window.current(observation.epoch);if(!latest)return;
   accepted.push(Date.now());gate.decide(.99);
   assert.equal(tracker.commit(u),false,'the request-time cursor must be stale');
   tracker.commit(latest);positions.push(tracker.position);
  },fail:assert.fail});
  await flush();t.mock.timers.tick(100);await flush();
 }
 assert.equal(accepted.length,1,'a verdict must apply while ASR is still changing');
 assert.ok(accepted[0]<=400);
 assert.equal(positions[0],8,'use the latest prefix, not the original three characters');
 assert.equal(tracker.position,10);
 assert.equal(tracker.commit(first),false);
});

test('an aside invalidates a reading verdict; returning locally invalidates the aside verdict',()=>{
 const tracker=new Teleprompter(),window=new FollowReviewWindow();
 const reading=tracker.propose(script,'接下来我用',false,'a')!;
 const first=window.observe(reading,script,0);tracker.commit(reading);
 const aside=tracker.propose(script,'接下来我用这里补充一下大家看看屏幕',false,'a')!;
 const second=window.observe(aside,script,tracker.position);
 assert.equal(second.changed,true);assert.equal(window.current(first.epoch),null);
 const back=tracker.propose(script,'接下来我用这里补充一下大家看看屏幕跟读场景演示',false,'a')!;
 const third=window.observe(back,script,tracker.position);
 assert.equal(third.changed,true);assert.equal(window.current(second.epoch),null);
 assert.equal(canResumeNearby(back,script,tracker.position),true);
});

test('a paused gate resumes from four new exact characters without a network verdict',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();
 tracker.commit(tracker.propose(script,'接下来我用',true,'a')!);gate.decide(.05);
 const held=tracker.position;
 const short=tracker.propose(script,'跟读',false,'b')!;
 assert.equal(gate.tryResume(short,script,held),false);
 const back=tracker.propose(script,'跟读场景',false,'b')!;
 assert.equal(gate.tryResume(back,script,held),true);
 assert.equal(gate.probability,null,'local recovery must not invent a Jev probability');
 assert.equal(gate.mayTrack(back),true);tracker.commit(back);
 assert.equal(tracker.position,10);
});

test('fast recovery refuses incidental words, remote locations, stale prefixes, and semantic guesses',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();tracker.seek(18);gate.decide(.05);
 for(const [i,text] of ['接下来','接下来我用跟读场景','我照着稿子念屏幕标出我的位置','这里我补充一下大家看看效果'].entries()){
  const u=tracker.propose(script,text,false,String(i))!;
  assert.equal(gate.tryResume(u,script,18),false,text);
 }
 const near=tracker.propose(script,'我按稿件朗读',false,'next')!;
 gate.unavailable();assert.equal(gate.tryResume(near,script,18),false,'an explicit provider error remains visible');
 assert.equal(tracker.position,18);
});

test('ASR corrections, a new segment, and manual reset invalidate older gate responses',()=>{
 const tracker=new Teleprompter(),window=new FollowReviewWindow();
 const first=window.observe(tracker.propose(script,'接下来我用跟读',false,'a')!,script,0);
 const correction=window.observe(tracker.propose(script,'接下来我用',false,'a')!,script,0);
 assert.equal(window.current(first.epoch),null);
 const segment=window.observe(tracker.propose(script,'接下来我用',false,'b')!,script,0);
 assert.equal(window.current(correction.epoch),null);
 window.reset();assert.equal(window.current(segment.epoch),null);
});

test('recent speech, rather than an entire cumulative aside, is foregrounded for Jev',()=>{
 const old='这里我补充一下，大家可以看一下屏幕上的这个演示，刚才说的是其他内容。';
 const current='我按稿件朗读，标记就跟随我的位置。如果我临时补充几句话';
 const state=recentFollowSpeech(old+current);
 assert.ok(state.transcript.endsWith('如果我临时补充几句话'));
 assert.ok(!state.transcript.includes('大家可以'));
 assert.ok(state.earlierTranscript.includes('大家可以'));
 assert.equal(recentFollowSpeech('跟读场景').transcript,'跟读场景');
});

test('a cumulative ASR segment can recover after an aside without waiting for sentence finalization',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();
 tracker.commit(tracker.propose(script,'接下来我用',false,'a')!);
 const held=tracker.position;gate.decide(.02);
 const back=tracker.propose(script,'接下来我用这里插一句大家看屏幕跟读场景演示',false,'a')!;
 assert.equal(back.final,false);assert.equal(gate.tryResume(back,script,held),true);
 tracker.commit(back);assert.equal(tracker.position,12);assert.equal(tracker.confirmed,6);
});
