import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOSED_COVER,RIGHT_PAGE,LEFT_PAGE,openingPose,project,bookEase} from '../src/reference/book-opening';
const close=(a:readonly number[],b:readonly number[])=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-5,`${a} != ${b}`));
test('closed cover and fully open spread preserve the approved image coordinates',()=>{
 const start=openingPose(0),end=openingPose(1);
 for(const p of CLOSED_COVER)close(project(start.cover,p),p);
 for(const p of RIGHT_PAGE)close(project(end.spread,p),p);
 for(const p of LEFT_PAGE)close(project(end.left,p),p);
 assert.equal(start.paperOpacity,0);assert.equal(start.coverOpacity,1);assert.equal(end.coverOpacity,0);assert.equal(end.printOpacity,1);
});
test('cover, right page and unfolding left leaf share both hinge endpoints on every sampled frame',()=>{
 for(let i=0;i<=180;i++){
  const p=openingPose(i/180);
  close(project(p.cover,CLOSED_COVER[0]),project(p.spread,RIGHT_PAGE[0]));
  close(project(p.cover,CLOSED_COVER[3]),project(p.spread,RIGHT_PAGE[3]));
  close(project(p.spread,project(p.left,LEFT_PAGE[1])),p.hinge[0]);
  close(project(p.spread,project(p.left,LEFT_PAGE[2])),p.hinge[1]);
  assert.ok([...p.cover,...p.left,...p.spread].every(Number.isFinite));
 }
});
test('opening clock has smooth endpoints and print appears only after the cover turns away',()=>{
 assert.equal(bookEase(0),0);assert.equal(bookEase(1),1);assert.equal(bookEase(.5),.5);
 assert.equal(openingPose(.4).printOpacity,0);assert.equal(openingPose(.5).coverOpacity,0);
});
