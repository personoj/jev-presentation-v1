import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {locateReadingCharacter,scriptCharacters} from '../features/alignment/reading-visual';

export function ReadingManuscript({script,position,confirmed,paused,settled}:{script:string;position:number;confirmed:number;paused:boolean;settled:boolean}){
 const content=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [geometry,setGeometry]=useState<ReturnType<typeof locateReadingCharacter>>(null);
 const rows=useMemo(()=>{let offset=0;return script.split('\n').map(text=>{const chars=scriptCharacters(text).map(char=>({...char,start:char.start+offset,end:char.end+offset}));offset+=text.length+1;return chars})},[script]);
 useLayoutEffect(()=>{
  const element=content.current;if(!element)return;
  let disposed=false;
  const measure=()=>{
   if(disposed)return;
   const origin=element.getBoundingClientRect(),scale=origin.width/element.offsetWidth;
   if(!scale)return;
   const rects=Array.from(element.querySelectorAll<HTMLElement>('[data-script-start]')).map(span=>{
    const box=span.getBoundingClientRect();
    return {start:Number(span.dataset.scriptStart),end:Number(span.dataset.scriptEnd),left:(box.left-origin.left)/scale,right:(box.right-origin.left)/scale,top:(box.top-origin.top)/scale,bottom:(box.bottom-origin.top)/scale};
   });
   setGeometry(locateReadingCharacter(rects,position));
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  window.addEventListener('resize',measure);document.fonts.ready.then(measure);
  return()=>{disposed=true;observer.disconnect();window.removeEventListener('resize',measure)};
 },[script,position]);
 useLayoutEffect(()=>{
  const element=viewport.current;if(!element||!geometry)return;
  if(geometry.top<element.scrollTop||geometry.top+geometry.height>element.scrollTop+element.clientHeight){
   element.scrollTo({top:Math.max(0,geometry.top-74),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
 },[geometry?.top,geometry?.height]);
 return <div ref={viewport} className="r-reading-manuscript" data-position={position} data-confirmed={confirmed} data-paused={paused} data-settled={settled} aria-label="逐字跟读稿件">
  <div ref={content} className="r-reading-content">
   {geometry&&<div className="r-reading-guides" aria-hidden="true">
    <div className="r-reading-line-wash" style={{left:geometry.left-14,top:geometry.top-2,width:geometry.width+28,height:geometry.height+4}}/>
    <div className="r-reading-character-wash" style={{left:geometry.character.left-2,top:geometry.character.top+3,width:geometry.character.width+4,height:geometry.character.height-5}}/>
    <div key={geometry.start} className="r-reading-underline" style={{left:geometry.left,top:geometry.top+geometry.height-2,width:geometry.progress}}/>
   </div>}
   {rows.map((chars,row)=><div className="r-reading-line" key={row}>{chars.map(({char,start,end})=><span key={start} data-script-start={start} data-script-end={end} className={[
    end<=confirmed?'is-confirmed':'',end<=position?'is-traced':'',
    geometry&&start===geometry.character.start?'is-current':'',
    geometry&&start>=geometry.start&&end<=geometry.end?'on-current-line':'',
   ].filter(Boolean).join(' ')}>{char}</span>)}</div>)}
  </div>
 </div>
}
