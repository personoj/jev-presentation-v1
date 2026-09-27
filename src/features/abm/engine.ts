/** Fictional local cultural market. Integer currency; all decisions use the round-start snapshot. */
import {RESIDENT_PROFILES,PERSONA_BASELINES,type ResidentProfile} from './personas';
export type {ResidentProfile} from './personas';
export const ABM_PROTOCOL = 'personas8-v1';
export const INITIAL_TREASURY = 240;
export type Mode = 'rules' | 'jev';
export type Action = 'B01' | 'B02' | 'T01' | 'wait';
export type Resident = {id:string;profile:ResidentProfile;cash:number;initialCash:number;bookPreference:number;theatrePreference:number;travel:Record<string,number>;plannedRound:number;books:number;tickets:number;couponUsed:boolean};
export type Merchant = {id:'B01'|'B02'|'T01';name:string;kind:'book'|'theatre';cash:number;initialCash:number;price:number;basePrice:number;stock:number;unitCost:number;revenue:number;cost:number;sold:number;nextAction:string};
export type Decision = {residentId:string;action:Action;source:'rules'|'live';failed?:boolean;requestId?:string;probabilities?:Record<string,number>;input?:unknown};
export type Transaction = {round:number;residentId:string;merchantId:string;status:'settled'|'rejected'|'wait'|'error';reason:string;price:number;cash:number;subsidy:number;source:Decision['source']};
export type RoundSummary = {round:number;units:number;revenue:number;cash:number;subsidy:number;cost:number;errors:number;cumulativeUnits:number;cumulativeRevenue:number;transactions:Transaction[];decisions:Decision[];merchantActions:string[];merchantDecisions?:MerchantDecision[]};
export type Economy = {seed:number;policy:boolean;mode:Mode;round:number;residents:Resident[];merchants:Merchant[];government:{initial:number;available:number;reserved:number;spent:number;released:number};supplier:number;history:RoundSummary[]};
export const MODEL_RESIDENTS = RESIDENT_PROFILES.map(p=>p.id);
export const ACTIONS:Record<Action,string>={B01:'在书店一买一本书',B02:'在书店二买一本书',T01:'买一张戏票',wait:'本轮暂不消费'};
export function random(seed:number){let a=seed|0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function createEconomy(seed=17,policy=true,mode:Mode='rules'):Economy{
 const rng=random(seed);const jitter=(base:number,span:number)=>Math.round(base+(rng()*2-1)*span);const residents:Resident[]=RESIDENT_PROFILES.map((profile,i)=>{const b=PERSONA_BASELINES[i];const cash=jitter(b.cash,12);return{id:profile.id,profile:structuredClone(profile),cash,initialCash:cash,bookPreference:Math.max(0,Math.min(100,jitter(b.book,5))),theatrePreference:Math.max(0,Math.min(100,jitter(b.theatre,5))),travel:{B01:Math.max(1,jitter(b.travel[0],2)),B02:Math.max(1,jitter(b.travel[1],2)),T01:Math.max(1,jitter(b.travel[2],2))},plannedRound:Math.max(1,Math.min(12,jitter(b.plannedRound,1))),books:0,tickets:0,couponUsed:false}});
 const merchants:Merchant[]=[{id:'B01',name:'纸间书店',kind:'book',price:60,stock:4,unitCost:34},{id:'B02',name:'南街书店',kind:'book',price:70,stock:4,unitCost:40},{id:'T01',name:'街角剧场',kind:'theatre',price:90,stock:6,unitCost:38}].map(m=>({...m,basePrice:m.price,cash:500,initialCash:500,revenue:0,cost:0,sold:0,nextAction:'尚未调整'})) as Merchant[];
 return{seed,policy,mode,round:0,residents,merchants,government:{initial:INITIAL_TREASURY,available:policy?0:INITIAL_TREASURY,reserved:policy?INITIAL_TREASURY:0,spent:0,released:0},supplier:0,history:[]};
}
export function discount(state:Economy,r:Resident,m:Merchant){return state.policy&&state.round<6&&!r.couponUsed&&m.price>=60?30:0}
export function visibleState(state:Economy,residentId:string){const r=state.residents.find(r=>r.id===residentId)!;return{round:state.round+1,totalRounds:12,unit:'模拟货币；每轮为抽象决策周期',resident:{...r},policy:{enabled:state.policy,faceValue:30,minimumSpend:60,expiresAfterRound:6,oneUse:true,available:state.policy&&state.round<6&&!r.couponUsed},market:state.merchants.map(m=>({id:m.id,name:m.name,type:m.kind,price:m.price,stock:m.stock,travelBurden:r.travel[m.id],cashPrice:m.price-discount(state,r,m)})),constraints:'每轮最多购买一件；书籍最多两本、戏票最多一张（本演示的需求上限）。选择消费需有需求且现金足够。旅途负担进入效用，但不记作本局部市场的现金交易。其他居民的预算、偏好与行动不可见。'};}
export function ruleDecision(state:Economy,r:Resident):Decision{
 const choices=state.merchants.map(m=>{const paid=m.price-discount(state,r,m);const count=m.kind==='book'?r.books:r.tickets;const cap=m.kind==='book'?2:1;const preference=m.kind==='book'?r.bookPreference:r.theatrePreference;const time=state.round+1;const planBonus=time>=r.plannedRound?24:-Math.min(48,(r.plannedRound-time)*12);const utility=preference+planBonus*r.profile.planningWeight-paid*.78*r.profile.priceSensitivity-r.travel[m.id]*r.profile.distanceSensitivity-count*34;return{action:m.id,utility:paid<=r.cash&&m.stock>0&&count<cap?utility:-Infinity}}).sort((a,b)=>b.utility-a.utility);
 return{residentId:r.id,action:choices[0].utility>12?choices[0].action:'wait',source:'rules'};
}
export function ruleDecisions(state:Economy){return state.residents.map(r=>ruleDecision(state,r))}
export function settleRound(original:Economy,decisions:Decision[],deferMerchants=false):Economy{
 if(original.round>=12)throw new Error('已完成12轮');
 if(new Set(decisions.map(d=>d.residentId)).size!==original.residents.length||decisions.length!==original.residents.length||decisions.some(d=>!original.residents.some(r=>r.id===d.residentId)))throw new Error('每位居民必须恰有一个轮初决策');
 const state:Economy=structuredClone(original);const round=state.round+1;
 // Keyed shuffle gives exactly the same resource-allocation order to paired policy conditions.
 const rng=random(state.seed+round*104729);const order=[...decisions];for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 const transactions:Transaction[]=[];
 for(const d of order){const r=state.residents.find(r=>r.id===d.residentId)!;const base={round,residentId:r.id,merchantId:d.action,price:0,cash:0,subsidy:0,source:d.source};
  if(d.failed){transactions.push({...base,status:'error',reason:'推理失败，本轮意向缺失；未按不消费计数'});continue}
  if(d.action==='wait'){transactions.push({...base,status:'wait',reason:d.input&&typeof d.input==='object'&&'constraint' in d.input?'无可行消费（程序约束）':'主动暂不消费'});continue}
  const m=state.merchants.find(m=>m.id===d.action);if(!m){transactions.push({...base,status:'rejected',reason:'行动不在允许范围'});continue}
  const subsidy=discount(state,r,m);const paid=m.price-subsidy;let reason='';
  if(m.stock<1)reason='结算时已无库存';else if(r.cash<paid)reason='现金不足';else if((m.kind==='book'?r.books>=2:r.tickets>=1))reason='已达预设需求上限';else if(subsidy>state.government.reserved)reason='财政预留不足';
  if(reason){transactions.push({...base,status:'rejected',reason});continue}
  r.cash-=paid;m.stock--;m.cash+=m.price;m.revenue+=m.price;m.sold++;if(m.kind==='book')r.books++;else r.tickets++;
  if(subsidy){r.couponUsed=true;state.government.reserved-=subsidy;state.government.spent+=subsidy}
  transactions.push({...base,status:'settled',reason:'约束检查通过',price:m.price,cash:paid,subsidy});
 }
 const merchantActions:string[]=[];let cost=0;
 for(const m of state.merchants.filter(m=>m.kind==='theatre')){const sales=transactions.filter(t=>t.status==='settled'&&t.merchantId===m.id).length;const expenditure=sales*m.unitCost;m.cash-=expenditure;m.cost+=expenditure;state.supplier+=expenditure;cost+=expenditure;}
 if(round===6){state.government.released+=state.government.reserved;state.government.available+=state.government.reserved;state.government.reserved=0}
 const settled=transactions.filter(t=>t.status==='settled');const last=state.history.at(-1);const units=settled.length;const revenue=settled.reduce((a,t)=>a+t.price,0);
 state.history.push({round,units,revenue,cash:settled.reduce((a,t)=>a+t.cash,0),subsidy:settled.reduce((a,t)=>a+t.subsidy,0),cost,errors:transactions.filter(t=>t.status==='error').length,cumulativeUnits:(last?.cumulativeUnits||0)+units,cumulativeRevenue:(last?.cumulativeRevenue||0)+revenue,transactions,decisions:structuredClone(decisions),merchantActions});state.round=round;return deferMerchants?state:applyMerchants(state,ruleMerchantDecisions(state));
}
export type MerchantDecision={merchantId:string;action:'hold'|'restock'|'normal'|'discount';source:'rules'|'live';requestId?:string;failed?:boolean;input?:unknown;probabilities?:Record<string,number>;cached?:boolean};
export function merchantVisible(state:Economy,id:string){const m=state.merchants.find(m=>m.id===id)!;return{roundJustSettled:state.round,totalRounds:12,merchant:{...m},ownSalesThisRound:state.history.at(-1)?.transactions.filter(t=>t.status==='settled'&&t.merchantId===id).length||0,policy:{enabled:state.policy,expiresAfterRound:6},publicMarket:state.merchants.map(m=>({id:m.id,price:m.price,stock:m.stock})),rules:'书店可保持或最多补3本，按单位进货成本支付给外部供给方，预算不足减少数量；剧场总容量固定，可恢复原价或优惠15（最低60）。只读取自己经营状态与公开信息。'}}
export function ruleMerchantDecisions(state:Economy):MerchantDecision[]{return state.merchants.map(m=>{const sales=state.history.at(-1)?.transactions.filter(t=>t.status==='settled'&&t.merchantId===m.id).length||0;return{merchantId:m.id,action:m.kind==='book'?(m.stock<2&&sales>0?'restock':'hold'):(sales===0?'discount':'normal'),source:'rules'}})}
export function applyMerchants(original:Economy,decisions:MerchantDecision[]):Economy{const state=structuredClone(original);const summary=state.history.at(-1)!;if(summary.merchantActions.length)throw new Error('商家阶段已经完成');for(const m of state.merchants){const d=decisions.find(d=>d.merchantId===m.id);if(state.round===12){m.nextAction='观察期结束，不再追加供给'}else if(!d||d.failed){m.nextAction='经营意向缺失，保留原状态';summary.errors++}else if(m.kind==='book'){const units=d.action==='restock'?Math.min(3,Math.floor(m.cash/m.unitCost)):0;const cost=units*m.unitCost;m.stock+=units;m.cash-=cost;m.cost+=cost;state.supplier+=cost;summary.cost+=cost;m.nextAction=units?`下轮补入 ${units} 本；成本 ${cost}`:'下轮维持库存'}else{m.price=d.action==='discount'?Math.max(60,m.basePrice-15):m.basePrice;m.nextAction=`下轮票价 ${m.price}；剩余座位 ${m.stock}`}
summary.merchantActions.push(`${m.name}：${m.nextAction}${d?.source==='live'?' · Jev':''}`)}summary.merchantDecisions=structuredClone(decisions);return state}
export function runRules(seed:number,policy:boolean){let s=createEconomy(seed,policy);for(let i=0;i<12;i++)s=settleRound(s,ruleDecisions(s));return s}
export function audit(state:Economy):string[]{const errors:string[]=[];const all=state.history.flatMap(h=>h.transactions).filter(t=>t.status==='settled');if(state.residents.some(r=>r.cash<0))errors.push('居民现金为负');if(state.merchants.some(m=>m.cash<0||m.stock<0))errors.push('商家资源为负');if(state.government.available+state.government.reserved+state.government.spent!==state.government.initial)errors.push('财政账目不平');if(all.some(t=>t.cash+t.subsidy!==t.price))errors.push('交易账目不平');for(const r of state.residents){if(all.filter(t=>t.residentId===r.id&&t.subsidy>0).length>1)errors.push('重复核销');if(r.initialCash-r.cash!==all.filter(t=>t.residentId===r.id).reduce((n,t)=>n+t.cash,0))errors.push('居民现金账目不平')}
 for(const m of state.merchants){if(m.cash!==m.initialCash+m.revenue-m.cost)errors.push('商家现金账目不平')}
 if(state.supplier!==state.merchants.reduce((n,m)=>n+m.cost,0))errors.push('外部供给账目不平');return errors}
