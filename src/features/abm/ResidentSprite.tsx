import {useEffect,useState,type CSSProperties} from 'react';
import {RESIDENT_ATLASES,type ResidentPose} from './resident-motion';
import './resident-sprite.css';

type AssetName=keyof typeof RESIDENT_ATLASES;
const pending=new Map<string,Promise<boolean>>();
function preload(src:string){
 let request=pending.get(src);
 if(!request){request=new Promise<boolean>(resolve=>{const image=new Image();image.onload=()=>{if(image.decode)image.decode().then(()=>resolve(true),()=>resolve(true));else resolve(true)};image.onerror=()=>resolve(false);image.src=src});pending.set(src,request)}
 return request;
}
/** All eight identities share the same atlas layout. Pose atlases are decoded before swapping. */
export function ResidentSprite({spriteIndex,pose='idle',facing='right',className='',label}:{spriteIndex:number;pose?:ResidentPose;facing?:'left'|'right';className?:string;label?:string}){
 const [assets,setAssets]=useState<Partial<Record<AssetName,boolean>>>({});
 useEffect(()=>{let alive=true;Object.entries(RESIDENT_ATLASES).forEach(([name,src])=>{preload(src).then(loaded=>{if(alive)setAssets(previous=>({...previous,[name]:loaded}))})});return()=>{alive=false}},[]);
 const index=Math.max(0,Math.min(7,Math.floor(spriteIndex))),walk=pose==='walk'&&assets.walkA&&assets.walkB;
 const selected:AssetName=pose==='interact'&&assets.interact?'interact':assets.idle?'idle':'portrait';
 const unavailable=assets.portrait===false&&assets.idle===false;
 const style={'--sprite-x':`${index%4*100/3}%`,'--sprite-y':`${Math.floor(index/4)*100}%`,'--sprite-facing':facing==='left'?-1:1} as CSSProperties;
 return <span className={`resident-sprite ${walk?'resident-sprite-walking':''} ${className}`} style={style} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} data-pose={walk?'walk':selected}>
  {unavailable?<span className="resident-sprite-unavailable">{String(index+1).padStart(2,'0')}</span>:<>
   <span className="resident-sprite-frame resident-sprite-frame-a" style={{backgroundImage:`url("${RESIDENT_ATLASES[walk?'walkA':selected]}")`}}/>
   {walk&&<span className="resident-sprite-frame resident-sprite-frame-b" style={{backgroundImage:`url("${RESIDENT_ATLASES.walkB}")`}}/>}
  </>}
 </span>;
}
