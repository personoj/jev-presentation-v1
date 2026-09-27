import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonFrame,comparisonEvidence,timeline} from '../src/reference/comparison-motion';
import {readLocation,story} from '../src/deck/story';

test('paired demonstration uses one shared linear clock, freezes each model at its measured time, and keeps exact axis ratios',()=>{
 for(let t=0;t<=timeline.durationMs;t+=5){
  const frame=comparisonFrame(t);
  assert.ok(frame.jevSeconds<=frame.llmSeconds);
  assert.ok(frame.jevSeconds<=comparisonEvidence.jev.seconds);
  if(frame.llmSeconds<comparisonEvidence.jev.seconds)assert.equal(frame.jevSeconds,frame.llmSeconds);
 }
 const final=comparisonFrame(timeline.durationMs);
 assert.equal(final.llmSeconds,8.566);assert.equal(final.jevSeconds,.114);
 assert.ok(Math.abs((final.llmSeconds/timeline.axisSeconds)/(final.jevSeconds/timeline.axisSeconds)-8.566/.114)<1e-10);
 assert.equal(final.timeRatio,75);assert.equal(final.costRatio,171);
});
test('prices and conclusion are revealed after the timing comparison and remain completely visible at rest',()=>{
 assert.equal(comparisonFrame(timeline.timer[1]).cost,0);
 assert.equal(comparisonFrame(timeline.cost[0]).conclusion,0);
 const final=comparisonFrame(timeline.durationMs);
 for(const key of ['input','branches','models','timerReveal','cost','conclusion','footer'] as const)assert.equal(final[key],1);
 assert.equal(final.timing,false);
 assert.equal(comparisonFrame(-1).llmSeconds,0);
});
test('the overlay is the last click in slide four, before training; deep links and backward navigation share that step',()=>{
 assert.deepEqual(readLocation('#comparison/3'),{index:3,beat:3});
 assert.deepEqual(readLocation('#comparison/99'),{index:3,beat:3});
 assert.equal(story[3].beats.length,4);
 assert.equal(story[4].id,'training');
});
