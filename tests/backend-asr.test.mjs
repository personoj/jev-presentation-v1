import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAsrRelay } from '../server/asr.mjs';
class Client extends EventEmitter {readyState=1;messages=[];send(raw){this.messages.push(JSON.parse(raw));}close(){this.readyState=3;this.emit('close');}}
class Upstream extends EventEmitter {static last;readyState=1;bufferedAmount=0;messages=[];constructor(url,options){super();this.url=url;this.options=options;Upstream.last=this;}send(raw){this.messages.push(JSON.parse(raw));}terminate(){this.readyState=3;}}
const config={keys:{asr:'secret-only-server'},models:{asr:'qwen3-asr-flash-realtime'},asrUrl:'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'};
const event=(ws,value)=>ws.emit('message',Buffer.from(JSON.stringify(value)));
test('ASR relay combines confirmed text and revised stash, preserves segment IDs, drains on stop',()=>{
 const client=new Client();createAsrRelay(config,Upstream)(client);event(client,{type:'start'});
 const upstream=Upstream.last;upstream.emit('open');
 assert.equal(upstream.messages[0].type,'session.update');assert.equal(upstream.messages[0].session.sample_rate,16000);
 event(upstream,{type:'session.updated'});assert.equal(client.messages[0].type,'ready');
 client.emit('message',Buffer.from([0,0,1,0]),true);assert.equal(upstream.messages.at(-1).audio,'AAABAA==');
 event(upstream,{type:'conversation.item.input_audio_transcription.text',item_id:'segment-1',text:'我们',stash:'使用语义识别'});
 event(upstream,{type:'conversation.item.input_audio_transcription.text',item_id:'segment-1',text:'我们使用',stash:'语音识别'});
 assert.equal(client.messages.at(-1).text,'我们使用语音识别');assert.equal(client.messages.at(-1).segmentId,'segment-1');
 assert.equal(client.messages.at(-1).stableText,'我们使用');
 const count=client.messages.length;
 event(upstream,{type:'conversation.item.input_audio_transcription.text',item_id:'segment-1',text:'我们使用',stash:'语音识别'});
 assert.equal(client.messages.length,count,'identical revisions are deduplicated');
 event(upstream,{type:'conversation.item.input_audio_transcription.text',item_id:'segment-1',text:'我们使用语音',stash:'识别'});
 assert.equal(client.messages.length,count+1,'a changed stable prefix must still arrive');
 event(client,{type:'stop'});assert.equal(upstream.messages.at(-1).type,'session.finish');
 event(upstream,{type:'conversation.item.input_audio_transcription.completed',item_id:'segment-1',transcript:'我们使用语音识别。'});
 assert.equal(client.messages.at(-1).type,'final');
 event(upstream,{type:'session.finished'});assert.equal(client.messages.at(-1).type,'stopped');assert.equal(client.readyState,3);
 assert.equal(JSON.stringify(client.messages).includes('secret-only-server'),false);
});
test('ASR disconnect destroys upstream and early stop never opens microphone or upstream',()=>{
 const client=new Client();createAsrRelay(config,Upstream)(client);event(client,{type:'start'});const upstream=Upstream.last;client.close();assert.equal(upstream.readyState,3);
 const early=new Client();createAsrRelay(config,Upstream)(early);event(early,{type:'stop'});assert.equal(early.messages[0].type,'stopped');
});
test('ASR raw upstream error never leaks provider content',()=>{
 const client=new Client();createAsrRelay(config,Upstream)(client);event(client,{type:'start'});
 event(Upstream.last,{type:'error',error:{code:'invalid_value',message:'secret-only-server'}});
 assert.equal(client.messages[0].type,'error');assert.equal(JSON.stringify(client.messages).includes('secret-only-server'),false);
});
