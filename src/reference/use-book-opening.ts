import {useLayoutEffect,useRef,useState} from 'react';
import {BOOK_OPEN_MS,bookEase} from './book-opening';

/** One reversible clock for cover, hinge and both leaves. Native animation
 * timing also allows the existing motion inspector to scrub every surface. */
export function useBookOpening(opening:boolean){
 const [progress,setProgress]=useState(opening?0:1),current=useRef(progress),driver=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const from=current.current,to=opening?0:1,element=driver.current;
  if(from===to||!element)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){current.current=to;setProgress(to);return;}
  const duration=BOOK_OPEN_MS*Math.abs(to-from);
  const clock=element.animate([{opacity:0},{opacity:1}],{duration,easing:'linear',fill:'both'});
  const inspect=new URLSearchParams(location.search).has('motion-qa');let frame=0,disposed=false;
  const tick=()=>{
   if(disposed)return;const t=Math.max(0,Math.min(1,Number(clock.currentTime??0)/duration));
   const p=from+(to-from)*bookEase(t);current.current=p;setProgress(p);
   if(t<1||inspect)frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);
  return()=>{disposed=true;cancelAnimationFrame(frame);clock.cancel()};
 },[opening]);
 return {progress,driver};
}
