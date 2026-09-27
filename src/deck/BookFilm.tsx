import {useEffect,useRef,useState} from 'react';
import {createSegmentPlayer,type SegmentPlayer,type TimelineSegment,type TimelineState} from './motion-runtime';

/** A single native film from closed to open. The camera then moves this same surface.
 * There is no switch from a perspective book frame to a differently framed close-up. */
export function BookFilm({open,visible=true}:{open:boolean;visible?:boolean}){
 const video=useRef<HTMLVideoElement>(null),player=useRef<SegmentPlayer|null>(null);
 const initial=useRef(open),target=useRef(open),shown=useRef(visible);target.current=open;shown.current=visible;
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const element=video.current;if(!element)return;
  let disposed=false;const abort=new AbortController();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  async function setup(){
   try{
    const response=await fetch('/media/book-timeline.json',{signal:abort.signal});
    if(!response.ok)throw new Error('book timeline unavailable');
    const timeline=await response.json() as {segments:TimelineSegment[];states:TimelineState[];frameDuration:number};
    if(disposed)return;
    const ready=()=>{
     if(disposed||player.current)return;
     player.current=createSegmentPlayer({video:element!,segments:timeline.segments.slice(0,1),states:timeline.states.slice(0,2),frameDuration:timeline.frameDuration,initialState:initial.current?'open':'closed',reducedMotion:motion.matches,onError:()=>{if(!disposed)setFailed(true)}});
     if(shown.current)player.current.goTo(target.current?'open':'closed');
    };
    if(element!.readyState>=1)ready();else element!.addEventListener('loadedmetadata',ready,{once:true,signal:abort.signal});
   }catch(e){if(!disposed&&!abort.signal.aborted)setFailed(true)}
  }
  void setup();
  const visibility=()=>{if(document.hidden||!shown.current)player.current?.cancel();else player.current?.goTo(target.current?'open':'closed')};
  document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;abort.abort();player.current?.destroy();player.current=null;document.removeEventListener('visibilitychange',visibility)};
 },[]);
 useEffect(()=>{if(visible)player.current?.goTo(open?'open':'closed');else player.current?.cancel()},[open,visible]);
 return <div className="book-native-film">{failed?<img src={`/media/book-flip/desktop/${open?'open':'closed'}.webp`} alt="《思考，快与慢》概念导读"/>:<video ref={video} src="/media/book.mp4" poster="/media/book-poster.png" muted playsInline preload="auto" aria-label={open?'翻开的概念导读书':'《思考，快与慢》概念导读书'} onError={()=>setFailed(true)}/>}</div>;
}
