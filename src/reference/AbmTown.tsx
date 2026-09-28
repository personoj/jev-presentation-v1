import {useEffect,useRef,useState} from 'react';
import type {Economy,ResidentProfile} from '../features/abm/engine';
import {ResidentSprite} from '../features/abm/ResidentSprite';
import {residentRoute,routeKeyframes,type Point} from '../features/abm/resident-motion';
import {ACTION_NAMES} from './abm-data';
import timing from '../../production/abm-pages/build/timeline.json';

const homes:Point[]=[{x:17,y:43},{x:35,y:42},{x:72,y:44},{x:86,y:47},{x:12,y:89},{x:36,y:90},{x:68,y:90},{x:89,y:90}];
const roundHomes:Point[]=[{x:12,y:89},{x:35,y:42},{x:72,y:44},{x:78,y:90},{x:23,y:89},{x:36,y:90},{x:68,y:90},{x:89,y:90}];
export function townPosition(frame:Economy,index:number):Point{
 const tx=frame.history.at(-1)?.transactions.find(t=>t.residentId===frame.residents[index].id);
 if(tx?.status!=='settled')return roundHomes[index];
 const queue=frame.residents.filter(p=>frame.history.at(-1)?.transactions.some(t=>t.residentId===p.id&&t.status==='settled'&&t.merchantId===tx.merchantId));
 const slot=queue.findIndex(p=>p.id===tx.residentId),center=tx.merchantId==='B01'?21:tx.merchantId==='T01'?51:83;
 return{x:center+(slot-(queue.length-1)/2)*5.4,y:42};
}
export function Portrait({person,className=''}:{person:ResidentProfile;className?:string}){
 return <span aria-hidden="true" className={`abm-portrait ${className}`} style={{backgroundPosition:`${person.spriteIndex%4*100/3}% ${Math.floor(person.spriteIndex/4)*100}%`}}/>;
}
function Walker({frame,index,selected,onSelect,compact,intro}:{frame:Economy;index:number;selected:string;onSelect:(id:string)=>void;compact:boolean;intro:boolean}){
 const person=frame.residents[index],target=intro?homes[index]:townPosition(frame,index),ref=useRef<HTMLButtonElement>(null),trail=useRef<SVGPathElement>(null),previous=useRef(target),[walking,setWalking]=useState(false);
 const transaction=frame.history.at(-1)?.transactions.find(t=>t.residentId===person.id);
 useEffect(()=>{
  const el=ref.current;if(!el)return;let alive=true;
  const parent=el.parentElement!;const computed=getComputedStyle(el);
  const start={x:parseFloat(computed.left)/parent.clientWidth*100,y:parseFloat(computed.top)/parent.clientHeight*100};
  const from=Number.isFinite(start.x)?start:previous.current;previous.current=target;
  el.style.left=`${target.x}%`;el.style.top=`${target.y}%`;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||Math.hypot(from.x-target.x,from.y-target.y)<.2){setWalking(false);return}
  setWalking(true);
  const route=residentRoute({...from,y:from.y<50?34:from.y},{...target,y:target.y<50?34:target.y});
  route[0]=from;route[route.length-1]=target;
  let routeAnimation:Animation|undefined;
  if(trail.current){trail.current.setAttribute('d',route.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '));routeAnimation=trail.current.animate([{strokeDashoffset:1,opacity:0},{strokeDashoffset:1,opacity:.65,offset:.05},{strokeDashoffset:0,opacity:.65,offset:.85},{strokeDashoffset:0,opacity:0}],{duration:compact?timing.compactWalkMs:timing.walkMs+400,fill:'none'})}
  const animation=el.animate(routeKeyframes(route),{duration:compact?timing.compactWalkMs:timing.walkMs,easing:'linear',fill:'none'});
  animation.finished.then(()=>{if(alive)setWalking(false)},()=>{});
  return()=>{alive=false;const current=getComputedStyle(el);const left=current.left,top=current.top;animation.cancel();routeAnimation?.cancel();el.style.left=left;el.style.top=top};
 },[frame,compact,target.x,target.y]);
 return <><svg className="abm-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path ref={trail} pathLength="1" strokeDasharray="1" fill="none" stroke={index%2?'#526844':'#a33a20'} strokeWidth=".25" strokeLinecap="round"/></svg><button ref={ref} className={`abm-walker ${selected===person.id?'selected':''} ${walking?'walking':''}`} style={{left:`${previous.current.x}%`,top:`${previous.current.y}%`}} aria-label={`选择${person.profile.name}`} aria-pressed={selected===person.id} onClick={()=>onSelect(person.id)} data-resident={person.id}>
  <ResidentSprite spriteIndex={person.profile.spriteIndex} pose={walking?'walk':'idle'}/>
  <span className="abm-person-label">{person.profile.name}<small>{walking?'前往目的地':!frame.round?person.profile.archetype:transaction?.status==='settled'?ACTION_NAMES[transaction.merchantId as keyof typeof ACTION_NAMES]:'暂不消费'}</small></span>
  {!walking&&transaction?.status==='settled'&&<span className="abm-purchase" aria-hidden="true">{transaction.merchantId==='T01'?<svg viewBox="0 0 36 36"><path d="M5 8H31V14Q24 18 31 22V28H5V22Q12 18 5 14Z" fill="#ead0a4" stroke="#7f4431" strokeWidth="1.6"/><path d="M14 9V27" stroke="#a33a20" strokeDasharray="2 2"/><path d="M19 14H26M19 19H26M19 24H23" stroke="#7f4431" strokeWidth="1.4"/></svg>:<svg viewBox="0 0 36 36"><path d="M8 5L27 3V28L8 31Q4 30 4 27V9Q4 6 8 5Z" fill="#65765a" stroke="#4b5140" strokeWidth="1.5"/><path d="M9 7L25 5V26L9 28Z" fill="#b47d47"/><path d="M8 27L25 25V30L8 32Q4 31 5 29Q5 27 8 27Z" fill="#f5e4ba" stroke="#66523c" strokeWidth="1.2"/><path d="M12 11L22 10M12 15L22 14" stroke="#edc68d" strokeWidth="1.5"/></svg>}</span>}
 </button></>;
}
export function AbmTown({frame,selected,onSelect,box,compact=false,intro=false,onSettled}:{frame:Economy;selected:string;onSelect:(id:string)=>void;box:readonly[number,number,number,number];compact?:boolean;intro?:boolean;onSettled?:(round:number)=>void}){
 const[x,y,width,height]=box;
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{let alive=true;const animations=Array.from(root.current?.querySelectorAll('.abm-walker')??[]).flatMap(el=>el.getAnimations());Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(alive)onSettled?.(frame.round)});return()=>{alive=false}},[frame,onSettled]);
 return <div ref={root} className={`abm-town ${compact?'compact':''}`} style={{left:x,top:y,width,height}} aria-label={`${frame.policy?'有券':'无券'}第${frame.round}轮居民位置`}>
  {frame.residents.map((p,i)=><Walker key={p.id} frame={frame} index={i} selected={selected} onSelect={onSelect} compact={compact} intro={intro}/>)}
 </div>;
}
