import {useEffect,useRef,useState} from 'react';

/** Local review-only controls; absent from the normal presentation. */
export function MotionInspector({next,previous}:{next:()=>void;previous:()=>void}){
 const [paused,setPaused]=useState(false),[time,setTime]=useState(0),[speed,setSpeed]=useState(.25);
 const current=useRef({paused,time,speed});current.current={paused,time,speed};
 const animations=useRef(new Set<Animation>());
 useEffect(()=>{let frame=0;const scan=()=>{for(const a of document.getAnimations()){if(!animations.current.has(a)){animations.current.add(a);a.playbackRate=current.current.speed;if(current.current.paused){a.pause();a.currentTime=current.current.time}}}frame=requestAnimationFrame(scan)};scan();return()=>{cancelAnimationFrame(frame);for(const a of animations.current){a.playbackRate=1;if(a.playState==='paused')a.play()}}},[]);
 const pause=(value:boolean)=>{setPaused(value);for(const a of animations.current){if(value)a.pause();else a.play()}};
 const seek=(value:number)=>{setTime(value);setPaused(true);for(const a of animations.current){a.pause();a.currentTime=value}};
 return <aside className="r-motion-inspector" aria-label="动画逐帧检查"><button onClick={()=>{animations.current.clear();setTime(0);previous()}}>检查上一步</button><button onClick={()=>{animations.current.clear();setTime(0);next()}}>检查下一步</button><button onClick={()=>pause(!paused)}>{paused?'播放动画':'暂停动画'}</button><label>速度 <select value={speed} onChange={e=>{const value=Number(e.target.value);setSpeed(value);for(const a of animations.current)a.playbackRate=value}}><option value="1">1×</option><option value="0.25">0.25×</option><option value="0.1">0.1×</option></select></label><label>时间 {time} ms <input aria-label="动画时间" type="range" min="0" max="3000" step="50" value={time} onChange={e=>seek(Number(e.target.value))}/></label></aside>
}
