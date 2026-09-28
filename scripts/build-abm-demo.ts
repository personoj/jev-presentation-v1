import {writeFileSync} from 'node:fs';
import {createEconomy,settleRound,audit,discount,random,type Action,type Economy,type Resident,type Decision} from '../src/features/abm/engine';

// Deliberately staged teaching data, not model responses or a policy-effect estimate.
// Spread purchases across the full twelve-round presentation without changing settlement rules.
const schedule:Record<number,Record<string,Action>>={
 1:{R05:'B01'},2:{R07:'B01',R06:'T01'},3:{R02:'B01'},4:{R03:'B02'},
 5:{R08:'B01'},6:{R04:'T01',R01:'B01'},7:{R06:'B01'},8:{R02:'T01'},
 9:{R03:'B01'},10:{R07:'B01'},11:{R08:'T01'},12:{R01:'B02'},
};
const couponAdditions:Record<number,Record<string,Action>>={4:{R04:'B02'},9:{R08:'B01'}};
const actions:Action[]=['B01','B02','T01','wait'];
function feasible(state:Economy,resident:Resident,action:Action){
 if(action==='wait')return true;
 const merchant=state.merchants.find(m=>m.id===action)!;
 return merchant.stock>0&&resident.cash>=merchant.price-discount(state,resident,merchant)&&(merchant.kind==='book'?resident.books<2:resident.tickets<1);
}
function illustrationProbabilities(state:Economy,resident:Resident,chosen:Action):Record<string,number>{
 if(state.policy&&state.round===0&&resident.id==='R05')return {B01:.72,B02:.01,T01:.02,wait:.25};
 const rng=random(1739+state.round*97+resident.profile.spriteIndex*307+(state.policy?1:0));
 const other=actions.filter(a=>a!==chosen&&feasible(state,resident,a));
 const result:Record<string,number>={B01:0,B02:0,T01:0,wait:0};
 if(!other.length){result[chosen]=1;return result}
 const primary=Math.round(58+rng()*27),remaining=100-primary;
 const weights=other.map(action=>{
  if(action==='wait')return .6+rng();
  const merchant=state.merchants.find(m=>m.id===action)!;
  const preference=merchant.kind==='book'?resident.bookPreference:resident.theatrePreference;
  return (.25+rng())*preference/(1+resident.travel[action]);
 });
 const sum=weights.reduce((a,b)=>a+b,0);let assigned=0;
 other.forEach((action,i)=>{const part=i===other.length-1?remaining-assigned:Math.floor(remaining*weights[i]/sum);assigned+=part;result[action]=part/100});
 result[chosen]=primary/100;return result;
}
function build(policy:boolean){
 let state=createEconomy(17,policy,'rules');const snapshots=[state];
 for(let round=1;round<=12;round++){
  const plan={...schedule[round],...(policy?couponAdditions[round]:{})};
  const decisions:Decision[]=state.residents.map(resident=>{
   const action=plan[resident.id]??'wait';
   if(!feasible(state,resident,action))throw new Error(`Infeasible staged action: ${policy}/${round}/${resident.id}/${action}`);
   return {residentId:resident.id,action,source:'rules',probabilities:illustrationProbabilities(state,resident,action)};
  });
  state=settleRound(state,decisions);
  if(audit(state).length||state.history.at(-1)!.transactions.some(t=>t.status==='rejected'||t.status==='error'))throw new Error(`Settlement failed at round ${round}`);
  snapshots.push(state);
 }
 return {id:`illustrative-${policy?'coupon':'baseline'}`,policy,snapshots:snapshots.map(({history,...frame})=>({...frame,residents:frame.residents.map(({profile,...resident})=>resident)})),rounds:state.history};
}
const output={schemaVersion:1,protocol:'personas8-v1',kind:'illustrative',seed:17,source:'presentation-simulation',description:'Scripted illustrative actions and probabilities; all balances, inventory and coupon settlement computed by the existing engine.',profiles:createEconomy().residents.map(r=>r.profile),runs:[build(false),build(true)]};
writeFileSync(new URL('../public/data/abm-demo.json',import.meta.url),JSON.stringify(output));
for(const run of output.runs)console.log(JSON.stringify({policy:run.policy,unitsByRound:run.rounds.map(r=>r.units),final:run.rounds.at(-1),subsidy:run.snapshots.at(-1)!.government.spent},(key,value)=>['transactions','decisions','merchantDecisions','merchantActions'].includes(key)?undefined:value));
