import test from 'node:test';
import assert from 'node:assert/strict';
import {Teleprompter,FollowGate} from '../src/features/alignment/teleprompter';
import {FOLLOWING_QUESTION} from '../src/features/alignment/judgment';
const script='接下来，我用跟读场景演示这套流程。\n我按稿件朗读，标记就跟随我的位置。\n如果我临时补充几句话，标记会停住。';

test('normal local tracking works without a model verdict or model location',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();const update=tracker.propose(script,'接下来我用跟读',false,'a')!;
 assert.equal(gate.probability,null);assert.equal(gate.mayTrack(update),true);tracker.commit(update);assert.equal(tracker.position,8);
 assert.equal(FOLLOWING_QUESTION.type,'noul');assert.equal(FOLLOWING_QUESTION.criteria,undefined);
});
test('the gate pauses a local proposal without rewinding, then resumes at that same local position',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();const first=tracker.propose(script,'接下来我用',true,'a')!;tracker.commit(first);const held=tracker.position;
 gate.decide(.05);const next=tracker.propose(script,'跟读场景演示这套流程',true,'b')!;
 assert.equal(gate.mayTrack(next),false);assert.equal(tracker.position,held);
 gate.decide(.95);assert.equal(gate.mayTrack(next,true),true);tracker.commit(next);assert.equal(tracker.position,next.candidate!.end);
});
test('a relocation uses current follow permission; Jev cannot invent a coordinate',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();tracker.seek(34);gate.decide(.99);
 const update=tracker.propose(script,'接下来',false,'return')!;
 assert.equal(update.candidate!.end,3);assert.equal(update.relocation,true);assert.equal(tracker.position,34);
 assert.equal(gate.mayTrack(update),true,'an open gate lets the ordinary tracker handle rereading');
 gate.decide(.9);assert.equal(gate.mayTrack(update,true),true);tracker.commit(update);assert.equal(tracker.position,3);
});
test('old ASR revisions and a stale gate response cannot apply after new input',()=>{
 const tracker=new Teleprompter();const old=tracker.propose(script,'接下来',false,'a')!;const next=tracker.propose(script,'接下来我用',false,'a')!;
 assert.equal(tracker.commit(old),false);assert.equal(tracker.commit(next),true);
 tracker.propose(script,'我按稿件朗读',false,'b');assert.equal(tracker.propose(script,'接下来我用',true,'a'),null);
});
test('uncertain monitoring preserves the previous play/pause state',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();tracker.seek(34);const u=tracker.propose(script,'接下来',false,'r')!;
 gate.decide(.99);gate.decide(.5);assert.equal(gate.state,'following');assert.equal(gate.mayTrack(u,true),true);
 gate.decide(.1);gate.decide(.5);assert.equal(gate.state,'paused');assert.equal(gate.mayTrack(u,true),false);
});
test('manual seek invalidates stale work and strips already-heard audio from the same segment',()=>{
 const tracker=new Teleprompter();const old=tracker.propose(script,'接下来我用',false,'a')!;tracker.commit(old);tracker.seek(18);
 assert.equal(tracker.commit(old),false);const update=tracker.propose(script,'接下来我用我按稿件朗读',false,'a')!;
 assert.equal(update.text,'我按稿件朗读');assert.equal(update.candidate!.end,24);tracker.commit(update);assert.equal(tracker.position,24);
});
test('fuzzy semantic estimates wait for a positive gate, while failed monitoring freezes',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();tracker.seek(18);
 const update=tracker.propose(script,'我照着稿子念，屏幕会标出我正在读的位置',true,'a')!;
 assert.ok(update.candidate?.semantic);assert.equal(gate.mayTrack(update),false);gate.decide(.99);assert.equal(gate.mayTrack(update,true),true);
 gate.unavailable();assert.equal(gate.mayTrack(update),false);assert.equal(gate.probability,null);
});
test('ASR revisions do not duplicate the history supplied to the follow monitor',()=>{
 const tracker=new Teleprompter(),gate=new FollowGate();for(const text of ['接下来','接下来我用']){gate.observe(tracker.propose(script,text,true,'a')!)}
 const next=tracker.propose(script,'我按稿件朗读',false,'b')!;assert.deepEqual(gate.context(next),['接下来我用']);
});
test('a growing exact prefix stays on its original anchor and does not create artificial confirmations',()=>{
 const tracker=new Teleprompter();
 for(const text of ['接下来','接下来我用','接下来我用跟读场景']){const u=tracker.propose(script,text,false,'a')!;assert.equal(u.relocation,false);tracker.commit(u);assert.equal(tracker.confirmed,0);assert.equal(tracker.anchor,0)}
 const final=tracker.propose(script,'接下来我用跟读场景',true,'a')!;tracker.commit(final);assert.equal(tracker.confirmed,10);
});
