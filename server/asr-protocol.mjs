import {randomUUID} from 'node:crypto';

export const isTaskASR=model=>/^(qwen-audio-3\.[01]-asr-flash-streaming|fun-asr|paraformer)/.test(model);
export const asrEndpoint=model=>`wss://dashscope.aliyuncs.com/api-ws/v1/${isTaskASR(model)?'inference':'realtime'}`;

/** Translate provider protocols without treating a revisable partial as stable. */
export function asrProtocol(model){
 const taskId=randomUUID(),task=isTaskASR(model);
 return {
  task,
  start:()=>task?{
   header:{action:'run-task',task_id:taskId,streaming:'duplex'},
   payload:{task_group:'audio',task:'asr',function:'recognition',model,input:{},parameters:{format:'pcm',sample_rate:16000,language_hints:['zh'],semantic_punctuation_enabled:false,max_sentence_silence:400,heartbeat:true}},
  }:{event_id:randomUUID(),type:'session.update',session:{input_audio_format:'pcm',sample_rate:16000,input_audio_transcription:{language:'zh'},turn_detection:{type:'server_vad',threshold:0,silence_duration_ms:400}}},
  audio:data=>task?data:JSON.stringify({event_id:randomUUID(),type:'input_audio_buffer.append',audio:data.toString('base64')}),
  stop:()=>task?{header:{action:'finish-task',task_id:taskId,streaming:'duplex'},payload:{input:{}}}:{event_id:randomUUID(),type:'session.finish'},
  read:event=>{
   if(task){
    if(event.header?.task_id!==taskId)return null;
    const kind=event.header.event;
    if(kind==='task-started')return {type:'ready',model};
    if(kind==='task-finished')return {type:'stopped'};
    if(kind==='task-failed')return {type:'provider-error',error:{code:event.header.error_code,message:event.header.error_message}};
    const s=event.payload?.output?.sentence;
    if(kind!=='result-generated'||!s||s.heartbeat||!s.text)return null;
    return {type:s.sentence_end?'final':'partial',text:s.text,stableText:s.sentence_end?s.text:'',segmentId:`${taskId}:${s.sentence_id??s.begin_time}`,words:s.words};
   }
   if(event.type==='session.updated')return {type:'ready',model};
   if(event.type==='session.finished')return {type:'stopped'};
   if(event.type==='conversation.item.input_audio_transcription.text')return {type:'partial',text:(event.text||'')+(event.stash||''),stableText:event.text||'',segmentId:event.item_id};
   if(event.type==='conversation.item.input_audio_transcription.completed')return {type:'final',text:event.transcript||'',segmentId:event.item_id};
   if(event.type==='error'||event.type==='conversation.item.input_audio_transcription.failed')return {type:'provider-error',error:event.error||event};
   return null;
  },
 };
}
