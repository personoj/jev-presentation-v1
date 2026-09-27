import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEconomy,ruleDecisions,settleRound} from '../src/features/abm/engine';
import {createMotionEpoch,residentArrivalPose,residentDestination,residentHome,residentRoute,routeKeyframes,shouldAnimateResidents} from '../src/features/abm/resident-motion';

test('only settled transactions may use the exchange pose',()=>{
 assert.equal(residentArrivalPose({status:'settled'}),'interact');
 for(const status of ['wait','rejected','error'] as const)assert.equal(residentArrivalPose({status}),'idle');
 assert.equal(residentArrivalPose(),'idle');
});
test('a cancelled walk cannot apply its delayed arrival to a later snapshot',()=>{
 const epoch=createMotionEpoch(),first=epoch.begin();assert.equal(epoch.isCurrent(first),true);
 epoch.invalidate();assert.equal(epoch.isCurrent(first),false);
 const replacement=epoch.begin();assert.equal(epoch.isCurrent(first),false);assert.equal(epoch.isCurrent(replacement),true);
 epoch.invalidate();assert.equal(epoch.isCurrent(replacement),false);
});
test('replays, resets and reduced-motion do not replay stale walks',()=>{
 const previous={seed:17,policy:true,round:3};
 assert.equal(shouldAnimateResidents(previous,{...previous,round:4},false),true);
 for(const next of [{...previous,round:2},{...previous,round:8},{...previous,seed:29,round:4},{...previous,policy:false,round:4},previous])assert.equal(shouldAnimateResidents(previous,next,false),false);
 assert.equal(shouldAnimateResidents(previous,{...previous,round:4},true),false);
});
test('eight home positions are separate and park routes bypass the fountain',()=>{
 const homes=Array.from({length:8},(_,i)=>residentHome(i));assert.equal(new Set(homes.map(p=>`${p.x},${p.y}`)).size,8);
 const path=residentRoute(homes[6],{x:50,y:33});
 assert.ok(path.some(p=>p.x===38.5&&p.y===57));
 for(let i=1;i<path.length;i++){
  const from=path[i-1],to=path[i];assert.ok(from.x===to.x||from.y===to.y,'routes stay on orthogonal streets');
  if(from.x===50&&to.x===50)assert.ok(Math.min(from.y,to.y)>=57||Math.max(from.y,to.y)<=34,'no route through the fountain');
 }
 const frames=routeKeyframes(path);assert.equal(frames[0].offset,0);assert.equal(frames.at(-1)!.offset,1);
 assert.ok(frames.every((frame,i)=>i===0||frame.offset>=frames[i-1].offset));
});
test('failed decisions do not depict travel or a successful purchase',()=>{
 const initial=createEconomy(),decisions=ruleDecisions(initial);decisions[0]={residentId:'R01',action:'B01',source:'live',failed:true};
 const state=settleRound(initial,decisions);assert.deepEqual(residentDestination(state,0),residentHome(0));
 assert.equal(residentArrivalPose(state.history[0].transactions.find(t=>t.residentId==='R01')),'idle');
});
