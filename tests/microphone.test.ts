import test from 'node:test';
import assert from 'node:assert/strict';
import {openMicrophone, ASR_STOP_TIMEOUT_MS, ASR_MAX_QUEUE_BYTES} from '../src/features/alignment/microphone.ts';

function browser(t:any) {
  const originals = new Map<string,PropertyDescriptor|undefined>();
  const replace = (name:string,value:unknown) => {originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});};
  const track={stops:0,stop(){this.stops++;}};
  class Node {static nodes:Node[]=[];constructor(){Node.nodes.push(this)}port:any={onmessage:null};disconnects=0;gain={value:1};connect(target:any){return target;}disconnect(){this.disconnects++;}}
  class Context {
    static current:Context;state='running';destination=new Node();audioWorklet={addModule:async()=>{}};closed=0;
    constructor(){Context.current=this;}createMediaStreamSource(){return new Node();}createGain(){return new Node();}async resume(){}async close(){this.closed++;this.state='closed';}
  }
  class Socket {
    static OPEN=1;static current:Socket;readyState=1;bufferedAmount=0;sent:string[]=[];
    onopen?:()=>void;onmessage?:(e:{data:string})=>void;onerror?:()=>void;onclose?:()=>void;
    constructor(){Socket.current=this;}send(value:string){this.sent.push(value);}close(){this.readyState=3;this.onclose?.();}
    receive(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
  }
  replace('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}});
  replace('AudioContext',Context);replace('AudioWorkletNode',Node);replace('WebSocket',Socket);replace('location',{protocol:'http:',host:'localhost:5178'});
  t.after(()=>{for(const [name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}});
  return {track,Socket,Context,Node};
}

test('stop sends the remaining worklet PCM before finishing the upstream session',async t=>{
 const {Socket,Node}=browser(t);const session=await openMicrophone(()=>{},()=>{});
 const ws=Socket.current,worklet=Node.nodes.find(n=>n.port.onmessage)!;ws.receive({type:'ready'});
 const pcm=new ArrayBuffer(100);worklet.port.postMessage=()=>{worklet.port.onmessage({data:{pcm,level:0}});worklet.port.onmessage({data:{flushed:true}})};
 session.stop();assert.equal(ws.sent[0],pcm);assert.equal(JSON.parse(ws.sent[1]).type,'stop');session.dispose();
});
test('excessive audio backlog stops visibly instead of silently dropping words',async t=>{
 const {Socket,Node,track}=browser(t),events:any[]=[];await openMicrophone(e=>events.push(e),()=>{});
 const ws=Socket.current;ws.receive({type:'ready'});ws.bufferedAmount=ASR_MAX_QUEUE_BYTES+1;
 Node.nodes.find(n=>n.port.onmessage)!.port.onmessage({data:{pcm:new ArrayBuffer(1280),level:0}});
 assert.equal(events.at(-1).code,'AUDIO_BACKPRESSURE');assert.equal(ws.readyState,3);assert.equal(track.stops,1);assert.equal(ws.sent.length,0);
});

test('stop accepts a final after the old five-second deadline and completes only on server stopped',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {track,Socket,Context}=browser(t),events:any[]=[];
  const session=await openMicrophone(e=>events.push(e),()=>{});const ws=Socket.current;
  ws.onopen?.();ws.receive({type:'ready'});session.stop();session.stop();
  assert.equal(track.stops,1,'capture stops immediately');
  assert.equal(ws.sent.filter(s=>JSON.parse(s).type==='stop').length,1,'stop is idempotent');
  t.mock.timers.tick(6000);
  assert.equal(events.some(e=>e.type==='stopped'||e.type==='error'),false);
  assert.equal(ws.readyState,1,'relay remains open while draining');
  ws.receive({type:'final',text:'最后一段完整识别。',segmentId:'last'});
  assert.equal(events.at(-1).text,'最后一段完整识别。');
  ws.receive({type:'stopped'});
  assert.equal(events.at(-1).type,'stopped');assert.equal(Context.current.closed,1);
  t.mock.timers.tick(20000);
  assert.equal(events.filter(e=>e.type==='stopped').length,1);assert.equal(events.some(e=>e.type==='error'),false);
});

test('missing server completion reports TIMEOUT, never a fabricated stopped event',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {Socket,Context}=browser(t),events:any[]=[];
  const session=await openMicrophone(e=>events.push(e),()=>{});session.stop();
  t.mock.timers.tick(15000);assert.equal(events.length,0,'allow the relay entire 15-second drain');
  t.mock.timers.tick(ASR_STOP_TIMEOUT_MS-15000);
  assert.equal(events.at(-1).code,'TIMEOUT');assert.equal(events.some(e=>e.type==='stopped'),false);assert.equal(Context.current.closed,1);
  Socket.current.receive({type:'final',text:'too late',segmentId:'last'});
  assert.equal(events.length,1,'events after disposal cannot revive a timed-out session');
});

test('unmount disposal immediately releases capture/socket and suppresses late callbacks',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {track,Socket,Context}=browser(t),events:any[]=[];
  const session=await openMicrophone(e=>events.push(e),()=>{});session.stop();session.dispose();
  assert.ok(track.stops>=1);assert.equal(Socket.current.readyState,3);assert.equal(Context.current.closed,1);
  Socket.current.receive({type:'final',text:'late'});Socket.current.onerror?.();t.mock.timers.tick(20000);
  assert.deepEqual(events,[]);
});

test('unexpected WebSocket closure is an error, not successful completion',async t=>{
  const {Socket,Context}=browser(t),events:any[]=[];
  await openMicrophone(e=>events.push(e),()=>{});Socket.current.close();
  assert.equal(events.at(-1).code,'ASR_CONNECTION_CLOSED');assert.equal(events.some(e=>e.type==='stopped'),false);assert.equal(Context.current.closed,1);
});
