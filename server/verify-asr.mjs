import { readFile, writeFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { createApp } from './index.mjs';
const audio=await readFile(new URL('./evidence/asr-synthetic.wav',import.meta.url));
let offset=12,pcm;
while(offset+8<=audio.length){const name=audio.toString('ascii',offset,offset+4),size=audio.readUInt32LE(offset+4);if(name==='data'){pcm=audio.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
if(!pcm)throw Error('WAV data missing');
const server=await createApp();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const evidence={testedAt:new Date().toISOString(),source:'Windows Microsoft Huihui Desktop synthetic speech, no microphone',sampleRate:16000,channels:1,bits:16,durationSec:pcm.length/32000,events:[],docs:['https://help.aliyun.com/zh/model-studio/qwen-asr-realtime-client-events','https://help.aliyun.com/zh/model-studio/qwen-asr-realtime-server-events']};
const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/asr`);
let result=false;const start=performance.now();
await new Promise(resolve=>{
 const timer=setTimeout(()=>{ws.terminate();resolve();},50000);
 ws.on('open',()=>ws.send(JSON.stringify({type:'start'})));
 ws.on('message',async raw=>{
  const event=JSON.parse(raw.toString());evidence.events.push({...event,elapsedMs:Math.round(performance.now()-start)});
  if(event.type==='ready'){
   for(let i=0;i<pcm.length;i+=3200){if(ws.readyState!==WebSocket.OPEN)return;ws.send(pcm.subarray(i,i+3200));await new Promise(r=>setTimeout(r,100));}
   if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'stop'}));
  }
  if(event.type==='final')result=true;
  if(event.type==='error')console.log(JSON.stringify(event));
  if(event.type==='stopped'){clearTimeout(timer);resolve();}
 });
 ws.on('close',()=>{clearTimeout(timer);resolve();});ws.on('error',()=>{clearTimeout(timer);resolve();});
});
ws.terminate();await new Promise(r=>server.close(r));
evidence.success=result;await writeFile(new URL('./evidence/asr-live.json',import.meta.url),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({success:result,audioSeconds:evidence.durationSec,events:evidence.events.filter(e=>e.type!=='partial'),partialCount:evidence.events.filter(e=>e.type==='partial').length}));
if(!result)process.exitCode=1;
