import type {Economy,Resident,ResidentProfile,RoundSummary,Action} from '../features/abm/engine';
export type FrameInput=Omit<Economy,'history'|'residents'>&{residents:Omit<Resident,'profile'>[]};
export type ChapterArchive={schemaVersion:1;protocol:string;kind?:'illustrative'|'recorded-jev';seed:number;profiles:ResidentProfile[];runs:{id:string;policy:boolean;snapshots:FrameInput[];rounds:RoundSummary[]}[]};
export type ChapterData={seed:number;kind:'illustrative'|'recorded-jev';profiles:ResidentProfile[];yes:Economy[];no:Economy[]};
export const ACTION_ORDER:Action[]=['B01','B02','T01','wait'];
export const ACTION_NAMES:Record<Action,string>={B01:'纸间书店',B02:'南街书店',T01:'街角剧场',wait:'暂不消费'};
export const ACTION_RESULTS:Record<Action,string>={B01:'去纸间书店购书',B02:'去南街书店购书',T01:'去街角剧场购票',wait:'本轮暂不消费'};
export const PROFILE_COPY:Record<string,string>={R01:'按阅读计划购书，愿意等待',R02:'喜欢文化活动，愿意即兴消费',R03:'重视书籍，按原有计划购书',R04:'乐于探索新的文化体验',R05:'喜欢读书，重视实付价格',R06:'偏好戏剧，愿意为体验付费',R07:'看重距离，喜欢就近购书',R08:'时间紧张，倾向按计划消费'};
export function prepareChapter(raw:ChapterArchive):ChapterData{
 if(raw.schemaVersion!==1||raw.protocol!=='personas8-v1'||raw.profiles.length!==8)throw new Error('小镇实验记录格式不匹配');
 const build=(policy:boolean)=>{
  const run=raw.runs.find(r=>r.policy===policy);
  if(!run||run.snapshots.length!==13||run.rounds.length!==12)throw new Error('缺少完整的配对实验');
  return run.snapshots.map((s,i)=>({...s,history:run.rounds.slice(0,i),residents:s.residents.map(r=>{
   const profile=raw.profiles.find(p=>p.id===r.id);if(!profile)throw new Error('缺少居民资料');return {...r,profile};
  })}));
 };
 return {seed:raw.seed,kind:raw.kind??'recorded-jev',profiles:raw.profiles,yes:build(true),no:build(false)};
}
export function residentTurn(frames:Economy[],round:number,id:string){
 const r=Math.max(1,Math.min(12,round)),before=frames[r-1],after=frames[r];
 const person=before.residents.find(p=>p.id===id);if(!person)throw new Error('居民不存在');
 const decision=after.history[r-1].decisions.find(d=>d.residentId===id),transaction=after.history[r-1].transactions.find(t=>t.residentId===id);
 return {person,before,after,decision,transaction,action:decision?.action??'wait'};
}
export function totals(frame:Economy){return {units:frame.history.at(-1)?.cumulativeUnits??0,revenue:frame.history.at(-1)?.cumulativeRevenue??0,subsidy:frame.government.spent}};
export function differenceMilestones(data:ChapterData){
 let previous=0;
 return data.yes.flatMap((frame,round)=>{const difference=totals(frame).units-totals(data.no[round]).units;if(difference===previous)return[];previous=difference;return [{round,difference}]});
}
