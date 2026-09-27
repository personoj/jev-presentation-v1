import {useEffect,useRef,useState} from 'react';
export function Media({id,poster,auto=false,className='',onEnd}:{id:string;poster:string;auto?:boolean;className?:string;onEnd?:()=>void}){
 const ref=useRef<HTMLVideoElement>(null);const [exists,setExists]=useState(false),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;fetch(`/media/${id}.mp4`,{method:'HEAD'}).then(r=>{if(active)setExists(r.ok&&!!r.headers.get('content-type')?.includes('video'))}).catch(()=>{});return()=>{active=false;ref.current?.pause()}},[id]);
 useEffect(()=>{if(auto&&exists&&!matchMedia('(prefers-reduced-motion: reduce)').matches){ref.current?.play().then(()=>setPlaying(true)).catch(()=>{})}},[exists,auto]);
 return <div className={`media-frame ${className}`}><img src={poster} alt="纸艺场景" loading="eager"/>{exists&&!failed&&<video ref={ref} src={`/media/${id}.mp4`} muted playsInline preload="auto" onError={()=>setFailed(true)} onEnded={()=>{setPlaying(false);onEnd?.()}} aria-label="场景动效"/>}{exists&&!failed&&!auto&&<button className="media-play" onClick={()=>{const v=ref.current;if(!v)return;if(playing){v.pause();setPlaying(false)}else{if(v.ended)v.currentTime=0;void v.play().then(()=>setPlaying(true)).catch(()=>setFailed(true))}}}>{playing?'暂停动效':'播放动效'} <span aria-hidden>↗</span></button>}</div>
}
