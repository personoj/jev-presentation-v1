import test from 'node:test';
import assert from 'node:assert/strict';
import {choicePose,noulPose,scorePose,SCORE_STOPS,timeline} from '../src/reference/primitive-motion';

test('Noul stays within the probability axis, traverses both directions and holds its midpoint for the final half second',()=>{
 for(let t=0;t<=timeline.noul.duration;t+=5){const p=noulPose(t);assert.ok(p.value>=0&&p.value<=1);assert.equal(p.x,621+428*p.value);assert.equal(p.y,591);}
 assert.equal(noulPose(800).value,.85);assert.equal(noulPose(1200).value,.25);
 for(let t=1850;t<=2350;t+=5){assert.equal(noulPose(t).value,.5);assert.equal(noulPose(t).x,835);}
});
test('Score lands at 0, 1, 2, 1, points toward each next landing and hides the arrow when settled',()=>{
 for(const [time,stop] of [[0,0],[1080,1],[1890,2],[2700,1],[3200,1]]){
  const p=scorePose(time);assert.equal(p.x,SCORE_STOPS[stop].x);assert.equal(p.y,SCORE_STOPS[stop].y);assert.equal(p.arrowOpacity,0);
 }
 assert.equal(scorePose(765).direction,1);assert.equal(scorePose(1575).to,2);
 assert.equal(scorePose(2385).direction,-1);assert.equal(scorePose(2385).to,1);
 assert.notEqual(scorePose(1450).arrow,scorePose(1650).arrow);
});
test('Score clears the stair risers throughout each jump and does not snap at segment boundaries',()=>{
 for(let t=0;t<=3200;t+=2){
  const p=scorePose(t);const highestTop=p.x+20>1428?537:p.x+20>1290?591:637;
  assert.ok(p.y+20<=highestTop+.1,`intersects step at ${t}ms: ${p.x},${p.y}`);
 }
 for(const [a,b] of timeline.score.hops){
  for(const t of [a,b]){const before=scorePose(t-.01),after=scorePose(t+.01);assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.02);}
 }
});
test('Choice scans every alternative then sends one packet to B and leaves a stable selection',()=>{
 assert.equal(choicePose(950).scan[0],1);assert.equal(choicePose(1250).scan[1],1);assert.equal(choicePose(1550).scan[2],1);
 assert.ok(choicePose(2000).packetVisible);assert.ok(choicePose(2000).packetX>127);
 const end=choicePose(timeline.choice.duration);assert.equal(end.packetX,397);assert.equal(end.packetVisible,false);assert.equal(end.settled,true);assert.equal(end.selected,1);
});
