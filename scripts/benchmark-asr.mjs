import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import WebSocket from 'ws';
import {createApp} from '../server/index.mjs';
import {loadConfig} from '../server/config.mjs';
import {asrEndpoint} from '../server/asr-protocol.mjs';

const name=process.argv[2]||'sample',chunkMs=Number(process.argv[3]||100);
const audio=await readFile(new URL('../server/evidence/asr-synthetic.wav',import.meta.url));
let pcm;for(let at=12;at+8<=audio.length;){const size=audio.readUInt32LE(at+4);if(audio.toString('ascii',at,at+4)==='data'){pcm=audio.subarray(at+8,at+8+size);break}at+=8+size+(size%2)}
if(!pcm)throw Error('No PCM in fixture');
const config=await loadConfig();if(process.argv[4]){config.models.asr=process.argv[4];config.asrUrl=asrEndpoint(config.models.asr)}
const app=await createApp({config});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const events=[],start=performance.now();let audioStart=0,done=false,sendTask=Promise.resolve();
const socket=new WebSocket(`ws://127.0.0.1:${app.address().port}/api/asr`);
await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{socket.terminate();reject(Error('ASR benchmark timeout'))},45000);
 const finish=()=>{clearTimeout(timer);done=true;resolve()};
 socket.on('open',()=>socket.send(JSON.stringify({type:'start'})));
 socket.on('message',raw=>{const event=JSON.parse(raw.toString());events.push({...event,atMs:Math.round(performance.now()-start)});
  if(event.type==='ready'){audioStart=performance.now();sendTask=(async()=>{const size=chunkMs*32;
   for(let at=0;at<pcm.length&&!done;at+=size){const due=audioStart+at/32;await new Promise(r=>setTimeout(r,Math.max(0,due-performance.now())));if(done||socket.readyState!==WebSocket.OPEN)return;socket.send(pcm.subarray(at,Math.min(pcm.length,at+size)))}
   if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'stop'}));
  })()}
  if(event.type==='stopped'||event.type==='error')finish();
 });socket.on('error',reject);socket.on('close',finish);
});
await sendTask;socket.terminate();await new Promise(r=>app.close(r));
const meaningful=[];let last='';for(const event of events){if(event.type!=='partial')continue;const text=event.text.replace(/[^\p{L}\p{N}]/gu,'');if(text!==last){meaningful.push(event);last=text}}
const gaps=meaningful.slice(1).map((e,i)=>e.atMs-meaningful[i].atMs).sort((a,b)=>a-b);
const p=q=>gaps[Math.min(gaps.length-1,Math.floor(gaps.length*q))]??null;
const summary={name,model:config.models.asr,errors:events.filter(e=>e.type==='error'),source:'Existing synthetic WAV streamed in real time to live cloud ASR; not live microphone',chunkMs,audioSeconds:pcm.length/32000,success:events.some(e=>e.type==='final')&&!events.some(e=>e.type==='error'),connectionReadyMs:events.find(e=>e.type==='ready')?.atMs,firstTextAfterAudioMs:meaningful[0]?Math.round(meaningful[0].atMs-(audioStart-start)):null,meaningfulUpdates:meaningful.length,updateGapMedianMs:p(.5),updateGapP95Ms:p(.95),finalText:events.filter(e=>e.type==='final').map(e=>e.text)};
await mkdir(new URL('../qa/latency/',import.meta.url),{recursive:true});await writeFile(new URL(`../qa/latency/${name}.json`,import.meta.url),JSON.stringify({summary,events},null,2));console.log(JSON.stringify(summary));
if(!summary.success)process.exitCode=1;
