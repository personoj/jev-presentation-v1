import {useLayoutEffect,useRef,useState} from 'react';
import {timeline,type PrimitiveKind} from './primitive-motion';

/** A separate cancellable clock per revealed column. Hidden columns retain
 * their pose through fade-out; quick reversals resume without teleporting. */
export function usePrimitiveClock(active:boolean,kind:PrimitiveKind){
 const [time,setTime]=useState(0),current=useRef(0),hiddenAt=useRef(-Infinity),driver=useRef<HTMLSpanElement>(null);
 const duration=timeline[kind].duration;
 useLayoutEffect(()=>{
  if(!active){hiddenAt.current=performance.now();return;}
  const node=driver.current;if(!node)return;
  const from=performance.now()-hiddenAt.current>timeline.hiddenResetMs?0:current.current;
  const publish=(t:number)=>{current.current=t;setTime(t)};
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  if(media.matches){publish(duration);return;}
  publish(from);if(from>=duration)return;
  const clock=node.animate([{opacity:0},{opacity:1}],{duration:duration-from,fill:'both'});
  const inspect=new URLSearchParams(location.search).has('motion-qa');let frame=0,disposed=false;
  const tick=()=>{if(disposed)return;const elapsed=Math.min(duration,from+Math.max(0,Number(clock.currentTime??0)));publish(elapsed);if(elapsed<duration||inspect)frame=requestAnimationFrame(tick)};
  const visibility=()=>{if(Number(clock.currentTime??0)>=duration-from)return;if(document.hidden)clock.pause();else if(!inspect)clock.play()};
  const reduce=()=>{if(media.matches){disposed=true;cancelAnimationFrame(frame);clock.cancel();publish(duration)}};
  media.addEventListener('change',reduce);document.addEventListener('visibilitychange',visibility);
  frame=requestAnimationFrame(tick);
  return()=>{disposed=true;cancelAnimationFrame(frame);clock.cancel();media.removeEventListener('change',reduce);document.removeEventListener('visibilitychange',visibility)};
 },[active,kind,duration]);
 return {time,driver};
}
