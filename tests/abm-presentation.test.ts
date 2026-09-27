import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareChapter,residentTurn,totals,differenceMilestones,ACTION_ORDER,type ChapterArchive} from '../src/reference/abm-data';
import {story,readLocation} from '../src/deck/story';

const raw=JSON.parse(readFileSync(new URL('../public/data/abm-presentation.json',import.meta.url),'utf8'));
const data=prepareChapter(raw as ChapterArchive);
test('compact presentation frames faithfully preserve all original paired Jev judgments and balances',()=>{
 const bytes=readFileSync(new URL('../public/data/experiments.json',import.meta.url));
 assert.equal(raw.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
 const source=JSON.parse(bytes.toString());
 for(const frames of [data.yes,data.no]){
  const original=source.runs.find((r:any)=>r.seed===17&&r.mode==='jev'&&r.protocolVersion==='personas8-v1'&&r.policy===frames[0].policy);
  assert.ok(original);assert.equal(frames.length,13);
  frames.forEach((frame,i)=>{
   assert.deepEqual(frame.residents,original.snapshots[i].residents);
   assert.deepEqual(frame.government,original.snapshots[i].government);
   assert.deepEqual(frame.merchants,original.snapshots[i].merchants);
   assert.equal(frame.history.length,i);
   if(i){assert.deepEqual(frame.history[i-1].transactions,original.state.history[i-1].transactions);assert.deepEqual(frame.history[i-1].decisions,original.state.history[i-1].decisions.map(({input,...d}:any)=>d))}
  });
 }
});
test('every selectable resident uses their own pre-round context, probabilities and settlement in every round',()=>{
 assert.equal(new Set(data.profiles.map(p=>p.id)).size,8);
 for(const frames of [data.yes,data.no])for(let round=1;round<=12;round++)for(const profile of data.profiles){
  const turn=residentTurn(frames,round,profile.id);
  assert.equal(turn.person.id,profile.id);assert.equal(turn.before.round,round-1);assert.equal(turn.after.round,round);
  assert.equal(turn.decision?.residentId,profile.id);assert.equal(turn.transaction?.residentId,profile.id);
  if(turn.decision?.probabilities){const probabilities=ACTION_ORDER.map(a=>turn.decision!.probabilities![a]);assert.ok(probabilities.every(p=>p>=0&&p<=1));assert.ok(Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)<.011)}
  if(turn.transaction?.status==='settled')assert.equal(turn.transaction.cash+turn.transaction.subsidy,turn.transaction.price);
 }
});
test('reference resident, waiting example, paired totals and milestones match the saved experiment',()=>{
 const xu=residentTurn(data.yes,1,'R05');assert.equal(xu.person.cash,84);assert.equal(xu.action,'B01');assert.equal(xu.decision?.probabilities?.B01,.72);assert.equal(xu.transaction?.cash,30);assert.equal(xu.transaction?.subsidy,30);
 assert.equal(residentTurn(data.yes,1,'R01').action,'wait');
 assert.deepEqual(totals(data.no[12]),{units:9,revenue:640,subsidy:0});assert.deepEqual(totals(data.yes[12]),{units:11,revenue:770,subsidy:210});
 assert.deepEqual(differenceMilestones(data),[{round:4,difference:1},{round:9,difference:2}]);
});
test('all four ABM pages and their click beats are reachable, including old links',()=>{
 assert.equal(story.length,14);for(let i=10;i<14;i++)for(let b=0;b<story[i].beats.length;b++)assert.deepEqual(readLocation(`#${story[i].id}/${b}`),{index:i,beat:b});
 assert.deepEqual(readLocation('#round'),{index:12,beat:0});assert.deepEqual(readLocation('#compare'),{index:13,beat:0});
 assert.throws(()=>prepareChapter({...raw,runs:[]}));
});
