import {memo,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {locateReadingCharacter,scriptCharacters,type ReadingRect} from '../features/alignment/reading-visual';

export const ReadingManuscript=memo(function ReadingManuscript({script,position,confirmed,paused,settled,range,onSeek}:{script:string;position:number;confirmed:number;paused:boolean;settled:boolean;range?:{start:number;end:number}|null;onSeek?:(position:number)=>void}){
 const content=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [rectangles,setRectangles]=useState<ReadingRect[]>([]);
 const geometry=useMemo(()=>locateReadingCharacter(rectangles,position),[rectangles,position]);
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
   setRectangles(rects);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  window.addEventListener('resize',measure);document.fonts.ready.then(measure);
  return()=>{disposed=true;observer.disconnect();window.removeEventListener('resize',measure)};
 },[script]);
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
    {!range&&<div className="r-reading-character-wash" style={{left:geometry.character.left-2,top:geometry.character.top+3,width:geometry.character.width+4,height:geometry.character.height-5}}/>}
    {!range&&<div key={geometry.start} className="r-reading-underline" style={{left:geometry.left,top:geometry.top+geometry.height-2,width:geometry.progress}}/>}
   </div>}
   {rows.map((chars,row)=><div className="r-reading-line" key={row} role={onSeek?'button':undefined} tabIndex={onSeek?0:undefined} aria-label={onSeek?`从本句继续：${chars.map(c=>c.char).join('')}`:undefined} title={onSeek?'点击从这一句继续':undefined} onClick={()=>onSeek?.(chars[0]?.start??0)} onKeyDown={event=>{if(onSeek&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();onSeek(chars[0]?.start??0)}}}>{chars.map(({char,start,end})=><span key={start} data-script-start={start} data-script-end={end} className={[
    end<=confirmed?'is-confirmed':'',end<=position?'is-traced':'',
    !range&&geometry&&start===geometry.character.start?'is-current':'',
    range&&start>=range.start&&end<=range.end?'is-semantic':'',
    geometry&&start>=geometry.start&&end<=geometry.end?'on-current-line':'',
   ].filter(Boolean).join(' ')}>{char}</span>)}</div>)}
  </div>
 </div>
});
