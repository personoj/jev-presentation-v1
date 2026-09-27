import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {asrEndpoint,asrProtocol} from '../server/asr-protocol.mjs';
import {createAsrRelay} from '../server/asr.mjs';
const model='qwen-audio-3.1-asr-flash-streaming';
test('streaming models use task protocol while existing Qwen realtime remains selectable',()=>{
 assert.ok(asrEndpoint(model).endsWith('/inference'));
 assert.ok(asrEndpoint('qwen3-asr-flash-realtime').endsWith('/realtime'));
 const p=asrProtocol(model),start=p.start();
 assert.equal(start.header.action,'run-task');assert.equal(start.payload.model,model);
 assert.equal(start.payload.parameters.max_sentence_silence,400);
 const pcm=Buffer.from([0,1]);assert.equal(p.audio(pcm),pcm);
 assert.equal(p.stop().header.task_id,start.header.task_id);
 assert.equal(asrProtocol('qwen3-asr-flash-realtime').start().type,'session.update');
});
test('task events retain sentence identity, ignore heartbeats and never invent stable prefixes',()=>{
 const p=asrProtocol(model),id=p.start().header.task_id;
 const result=(s,taskId=id)=>p.read({header:{event:'result-generated',task_id:taskId},payload:{output:{sentence:s}}});
 assert.equal(result({text:'错误任务'},'other'),null);
 assert.equal(result({heartbeat:true,sentence_id:0}),null);
 const words=[{text:'我们',begin_time:20,end_time:100}];
 const partial=result({text:'我们',sentence_id:1,sentence_end:false,words});
 const final=result({text:'我们。',sentence_id:1,sentence_end:true});
 assert.equal(partial.stableText,'');assert.equal(partial.type,'partial');assert.deepEqual(partial.words,words);
 assert.equal(final.type,'final');assert.equal(final.segmentId,partial.segmentId);
 assert.notEqual(result({text:'下一句',sentence_id:2}).segmentId,final.segmentId);
});
test('relay sends binary PCM, drains final results on stop, and sanitizes task failures',()=>{
 class Client extends EventEmitter {readyState=1;messages=[];send(x){this.messages.push(JSON.parse(x))}close(){this.readyState=3;this.emit('close')}}
 class Upstream extends EventEmitter {static last;readyState=1;bufferedAmount=0;messages=[];constructor(){super();Upstream.last=this}send(x){this.messages.push(Buffer.isBuffer(x)?x:JSON.parse(x))}terminate(){this.readyState=3}}
 const config={keys:{asr:'server-secret'},models:{asr:model},asrUrl:asrEndpoint(model)};
 const event=(ws,e)=>ws.emit('message',Buffer.from(JSON.stringify(e)));
 const client=new Client();createAsrRelay(config,Upstream)(client);event(client,{type:'start'});
 const upstream=Upstream.last;upstream.emit('open');const id=upstream.messages[0].header.task_id;
 event(upstream,{header:{task_id:id,event:'task-started'}});assert.equal(client.messages[0].model,model);
 const pcm=Buffer.from([0,0,1,0]);client.emit('message',pcm,true);assert.equal(upstream.messages.at(-1),pcm);
 event(client,{type:'stop'});assert.equal(upstream.messages.at(-1).header.action,'finish-task');
 event(upstream,{header:{task_id:id,event:'result-generated'},payload:{output:{sentence:{sentence_id:1,text:'尾段。',sentence_end:true}}}});
 assert.equal(client.messages.at(-1).type,'final');
 event(upstream,{header:{task_id:id,event:'task-finished'}});assert.equal(client.messages.at(-1).type,'stopped');assert.equal(client.readyState,3);
 const failed=new Client();createAsrRelay(config,Upstream)(failed);event(failed,{type:'start'});Upstream.last.emit('open');
 event(Upstream.last,{header:{task_id:Upstream.last.messages[0].header.task_id,event:'task-failed',error_code:'InvalidParameter',error_message:'server-secret'}});
 assert.equal(failed.messages.at(-1).type,'error');assert.equal(JSON.stringify(failed.messages).includes('server-secret'),false);
});
