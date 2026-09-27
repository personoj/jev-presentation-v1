import {useLayoutEffect,useRef,useState} from 'react';
import {clamp,timeline} from './comparison-motion';

/** Keep the sheet's current pose when interrupted. Content holds during exit;
 * a rapid reopen continues its clock instead of replaying from a blank sheet. */
export function useComparisonMotion(open:boolean){
 const [value,setValue]=useState({presence:0,time:0});
 const current=useRef(value),driver=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const start=current.current,element=driver.current;
  if(!element||(!open&&start.presence===0))return;
  const publish=(next:typeof value)=>{current.current=next;setValue(next)};
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const finish=()=>publish(open?{presence:1,time:timeline.durationMs}:{presence:0,time:0});
  if(media.matches){finish();return;}
  const duration=open?Math.max(timeline.presenceMs*(1-start.presence),timeline.durationMs-start.time):timeline.presenceMs*start.presence;
  if(duration<=0){finish();return;}
  const clock=element.animate([{opacity:0},{opacity:1}],{duration,fill:'both'});
  const inspect=new URLSearchParams(location.search).has('motion-qa');
  let frame=0,disposed=false;
  const tick=()=>{
   if(disposed)return;
   const elapsed=Math.min(duration,Math.max(0,Number(clock.currentTime??0)));
   publish(open?{
    presence:clamp(start.presence+elapsed/timeline.presenceMs),
    time:Math.min(timeline.durationMs,start.time+elapsed),
   }:elapsed>=duration?{presence:0,time:0}:{presence:clamp(start.presence-elapsed/timeline.presenceMs),time:start.time});
   if(elapsed<duration||inspect)frame=requestAnimationFrame(tick);
  };
  const visibility=()=>{if(Number(clock.currentTime??0)>=duration)return;if(document.hidden)clock.pause();else if(!inspect)clock.play()};
  const reduced=()=>{if(media.matches){disposed=true;cancelAnimationFrame(frame);clock.cancel();finish()}};
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',reduced);
  frame=requestAnimationFrame(tick);
  return()=>{disposed=true;cancelAnimationFrame(frame);clock.cancel();document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',reduced)};
 },[open]);
 return {...value,driver};
}
