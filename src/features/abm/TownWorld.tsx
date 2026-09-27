import {useEffect,useRef,useState} from 'react';
import type {Economy} from './engine';
import {ResidentSprite} from './ResidentSprite';
import {SHOP_DOORS,createMotionEpoch,residentArrivalPose,residentDestination,residentHome,residentRoute,routeKeyframes,shouldAnimateResidents,type Point,type ResidentPose} from './resident-motion';
import './town.css';

const MOVE_MS=1850,INTERACT_MS=1150;
export function TownWorld({state,selected,onSelect,compact=false}:{state:Economy;selected?:string;onSelect?:(id:string)=>void;compact?:boolean}){
 const [missingMap,setMissingMap]=useState(false);
 const [points,setPoints]=useState(()=>state.residents.map((_,i)=>residentDestination(state,i)));
 const [poses,setPoses]=useState<Record<string,ResidentPose>>({});
 const [arrived,setArrived]=useState<Set<string>>(()=>new Set(state.residents.map(r=>r.id)));
 const [facings,setFacings]=useState<Record<string,'left'|'right'>>({});
 const [reducedMotion,setReducedMotion]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const previous=useRef({seed:state.seed,policy:state.policy,round:state.round});
 const people=useRef(new Map<string,HTMLButtonElement>()),current=useRef(points),epoch=useRef(createMotionEpoch());
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReducedMotion(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 useEffect(()=>{
  const token=epoch.current.begin(),target=state.residents.map((_,i)=>residentDestination(state,i)),old=previous.current;
  previous.current={seed:state.seed,policy:state.policy,round:state.round};
  if(!shouldAnimateResidents(old,state,reducedMotion)){
   current.current=target;setPoints(target);setPoses({});setArrived(new Set(state.residents.map(r=>r.id)));return()=>epoch.current.invalidate();
  }
  const origin=current.current,moving=new Set(state.residents.flatMap((r,i)=>Math.hypot(target[i].x-(origin[i]||target[i]).x,target[i].y-(origin[i]||target[i]).y)>.2?[r.id]:[]));
  const finalTransactions=state.history.at(-1)?.transactions;
  const initialPoses:Record<string,ResidentPose>={},initialFacing:Record<string,'left'|'right'>={};
  state.residents.forEach((r,i)=>{initialPoses[r.id]=moving.has(r.id)?'walk':residentArrivalPose(finalTransactions?.find(t=>t.residentId===r.id));initialFacing[r.id]=target[i].x<(origin[i]||target[i]).x?'left':'right'});
  setPoses(initialPoses);setFacings(initialFacing);setArrived(new Set(state.residents.filter(r=>!moving.has(r.id)).map(r=>r.id)));
  const animations=state.residents.flatMap((r,i)=>{
   const element=people.current.get(r.id);if(!element||!moving.has(r.id))return[];
   return[element.animate(routeKeyframes(residentRoute(origin[i]||target[i],target[i])),{duration:MOVE_MS,easing:'linear'})];
  });
  setPoints(target);
  const finishWalk=setTimeout(()=>{
   if(!epoch.current.isCurrent(token))return;
   current.current=target;setArrived(new Set(state.residents.map(r=>r.id)));
   setPoses(Object.fromEntries(state.residents.map(r=>[r.id,residentArrivalPose(finalTransactions?.find(t=>t.residentId===r.id))])));
  },MOVE_MS);
  const finishInteraction=setTimeout(()=>{if(epoch.current.isCurrent(token))setPoses({})},MOVE_MS+INTERACT_MS);
  return()=>{
   epoch.current.invalidate();clearTimeout(finishWalk);clearTimeout(finishInteraction);
   // Preserve the visible position before cancelling: rapid scrubbing never teleports via an old endpoint.
   current.current=state.residents.map((r,i)=>{const element=people.current.get(r.id),parent=element?.offsetParent;if(!element||!parent)return target[i];const rect=parent.getBoundingClientRect(),style=getComputedStyle(element);const point:Point={x:parseFloat(style.left)/rect.width*100,y:parseFloat(style.top)/rect.height*100};return Number.isFinite(point.x)&&Number.isFinite(point.y)?point:target[i]});
   animations.forEach(animation=>animation.cancel());
  };
 },[state.round,state.seed,state.policy,state.history,reducedMotion]);
 const last=state.history.at(-1);
 return <div className={`town-world ${compact?'town-world-compact':''} ${missingMap?'town-missing-map':''}`}>
  <img className="town-map" src="/art/town-map.png" alt="俯视像素小镇：北侧书店和剧场，南侧居民住宅，步行道路连接街区" onError={()=>setMissingMap(true)}/>
  {missingMap&&<div className="town-asset-warning">小镇地图未加载 · 人物位置与账目仍可查看</div>}
  <div className="town-policy-plaque"><span>{state.policy?'文化消费券':'无消费券对照'}</span><strong>{state.policy?'满 60 减 30':'同一初始人群'}</strong><small>{state.policy?(state.round>=6?'消费券已到期':'每人一次 · 有效至第 6 轮'):`seed ${state.seed} · ${state.residents.length} 位居民`}</small></div>
  <div className="town-clock"><span>ROUND</span><strong>{String(state.round).padStart(2,'0')}<small> / 12</small></strong></div>
  <div className="town-buildings">{state.merchants.map(m=><button key={m.id} className={`town-building ${selected===m.id?'is-selected':''}`} style={{left:`${SHOP_DOORS[m.id].x}%`,top:'17%'}} onClick={()=>onSelect?.(m.id)} aria-label={`${m.name}，${m.kind==='book'?'书价':'票价'} ${m.price}，库存 ${m.stock}，点击查看经营状态`} title={`${m.name} · ${m.kind==='book'?'书价':'票价'} ${m.price} · 库存 ${m.stock}`}><span>{m.name}</span></button>)}</div>
  <div className="town-people" aria-label={`${state.residents.length} 位居民，点击查看性格、偏好与本轮行动`}>{state.residents.map((r,i)=>{
   const point=points[i]||residentHome(i),transaction=last?.transactions.find(t=>t.residentId===r.id),decision=last?.decisions.find(d=>d.residentId===r.id);
   const action=decision?.action,walking=poses[r.id]==='walk',settled=transaction?.status==='settled'&&arrived.has(r.id);
   const location=action&&action!=='wait'?state.merchants.find(m=>m.id===action)?.name:'社区';
   const status=walking?`正在前往${location}`:transaction?.status==='error'?'本轮判断未完成':transaction?.status==='rejected'?`未成交：${transaction.reason}`:settled?`已在${location}${transaction.merchantId==='T01'?'购票':'购书'}`:state.round?'留在社区，暂不消费':'尚未决策';
   const name=r.profile?.name||r.id,archetype=r.profile?.archetype||'居民';
   return <button key={r.id} ref={element=>{if(element)people.current.set(r.id,element);else people.current.delete(r.id)}} className={`town-person ${selected===r.id?'is-selected':''} ${walking?'is-walking':''} ${settled?'has-traded':''}`} style={{left:`${point.x}%`,top:`${point.y}%`}} onClick={()=>onSelect?.(r.id)} aria-label={`${name}，${archetype}，余额 ${r.cash}，${status}`} title={`${name} · ${archetype} · ${status}`}>
    <span className="town-person-shadow"/>
    <ResidentSprite spriteIndex={r.profile?.spriteIndex??i%8} pose={poses[r.id]||'idle'} facing={facings[r.id]||'right'}/>
    <span className="town-person-id">{name}</span>{settled&&<span className="town-action-bubble">{transaction.merchantId==='T01'?'票':'书'}</span>}
   </button>;
  })}</div>
  <div className="town-map-key"><span><i/> 成交后显示书 / 票</span><span>点击人物，认识他的选择</span><span>位置为示意 · 行动与金额来自模拟</span></div>
 </div>;
}
