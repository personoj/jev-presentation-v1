import {useEffect,useState} from 'react';
import {prepareChapter,type ChapterData} from './abm-data';
let cached:Promise<ChapterData>|undefined;
function read(){return cached??=(fetch('/data/abm-presentation.json').then(async r=>{if(!r.ok)throw new Error('小镇实验记录暂未加载');return prepareChapter(await r.json())}).catch(error=>{cached=undefined;throw error}))}
export function useAbmData(enabled:boolean){
 const [data,setData]=useState<ChapterData>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{if(!enabled)return;let active=true;setError('');read().then(value=>{if(active)setData(value)},reason=>{if(active)setError(reason instanceof TypeError?'暂时无法读取本地实验记录，请重新载入。':reason.message)});return()=>{active=false}},[enabled,attempt]);
 return {data,error,retry:()=>setAttempt(v=>v+1)};
}
