import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {audit,settleRound} from '../src/features/abm/engine';
import {prepareChapter,totals,differenceMilestones,ACTION_ORDER} from '../src/reference/abm-data';
const data=prepareChapter(JSON.parse(readFileSync(new URL('../public/data/abm-demo.json',import.meta.url),'utf8')));
test('illustrative data is separate from recorded Jev responses and starts with paired residents',()=>{
 assert.equal(data.kind,'illustrative');assert.deepEqual(data.yes[0].residents,data.no[0].residents);
 assert.deepEqual(data.yes[0].merchants,data.no[0].merchants);
 for(const frames of [data.yes,data.no])for(const round of frames[12].history)for(const decision of round.decisions){assert.equal(decision.source,'rules');assert.equal(decision.requestId,undefined)}
});
test('every demo round has visible purchases and all eight residents have distinct timing',()=>{
 for(const frames of [data.yes,data.no]){
  const rounds=frames[12].history;assert.equal(rounds.length,12);
  assert.ok(rounds.every(r=>r.units>=1&&r.units<=2));
  const schedules=data.profiles.map(p=>rounds.filter(r=>r.transactions.some(t=>t.residentId===p.id&&t.status==='settled')).map(r=>r.round));
  assert.ok(schedules.every(s=>s.length>0));assert.equal(new Set(schedules.map(s=>s.join(','))).size,8);
 }
});
test('staged decisions reproduce every balance, stock count and coupon transaction through the real settlement engine',()=>{
 for(const frames of [data.yes,data.no])for(let round=1;round<=12;round++){
  const after=frames[round],saved=after.history.at(-1)!;
  assert.deepEqual(settleRound(frames[round-1],saved.decisions),after);
  assert.deepEqual(audit(after),[]);
  assert.ok(saved.transactions.every(t=>t.status==='wait'||t.status==='settled'));
  for(const decision of saved.decisions){
   const probabilities=decision.probabilities!;
   assert.ok(Math.abs(ACTION_ORDER.reduce((sum,a)=>sum+probabilities[a],0)-1)<1e-9);
   assert.equal(ACTION_ORDER.reduce((best,a)=>probabilities[a]>probabilities[best]?a:best),decision.action);
  }
 }
});
test('policy totals and widening differences are derived consistently from the demo',()=>{
 assert.deepEqual(totals(data.no[12]),{units:12,revenue:800,subsidy:0});
 assert.deepEqual(totals(data.yes[12]),{units:18,revenue:1210,subsidy:240});
 assert.deepEqual(differenceMilestones(data),[{round:2,difference:1},{round:4,difference:2},{round:5,difference:3},{round:6,difference:4},{round:9,difference:5},{round:10,difference:6}]);
 assert.equal(data.yes[1].history[0].decisions.find(d=>d.residentId==='R05')?.probabilities?.B01,.72);
});
