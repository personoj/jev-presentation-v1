export const ASR_CHUNK_MS=40;
export const ASR_MAX_QUEUE_BYTES=16000; // 500 ms of PCM16; never silently build tens of seconds of delay.
type ASREvent = {type: 'partial' | 'final' | 'ready' | 'error' | 'stopped'; text?: string; model?:string; stableText?:string; segmentId?: string; code?: string; message?: string;timing?:{firstTextMs:number|null;updateGapMs:number|null;queueMs:number;chunkMs:number}};
// The relay drains for 15 seconds; allow its final transcript and terminal event to arrive.
export const ASR_STOP_TIMEOUT_MS = 17000;
export type MicrophoneSession = {stop: () => void; dispose: () => void};
export async function openMicrophone(onEvent: (event: ASREvent) => void, onLevel: (level: number) => void,options:{sampleUrl?:string}={}): Promise<MicrophoneSession> {
  const stream = options.sampleUrl?null:await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true}, video: false});
  let context: AudioContext | undefined, socket: WebSocket | undefined, worklet: AudioWorkletNode | undefined, source: AudioNode | undefined,sample:AudioBufferSourceNode|undefined,sampleStarted=false,stopSession=()=>{};
  let url = '', disposed = false, stopping = false, finishSent=false,lastLevelAt = 0, closeTimer: ReturnType<typeof setTimeout> | undefined,flushTimer: ReturnType<typeof setTimeout>|undefined;
  let firstAudioAt:number|undefined,lastTextAt:number|undefined,firstTextMs:number|null=null,updateGapMs:number|null=null,lastTranscript='';
  const dispose = () => { if (disposed) return; disposed = true; clearTimeout(closeTimer);clearTimeout(flushTimer); stream?.getTracks().forEach(t => t.stop());if(sample&&sampleStarted){sample.onended=null;sample.stop()} source?.disconnect(); worklet?.disconnect(); if (context?.state !== 'closed') void context?.close(); socket?.close(); if (url) URL.revokeObjectURL(url); onLevel(0); };
  try {
    context = new AudioContext();
    // The worklet integrates input samples into 16 kHz bins; fractional bins persist across blocks.
    const code = `class PCM extends AudioWorkletProcessor {
      constructor(){super();this.sum=0;this.weight=0;this.buffer=[];this.energy=0;this.count=0;this.port.onmessage=e=>{if(e.data.type==='flush'){this.flush();this.port.postMessage({flushed:true});}};}
      flush(){if(!this.buffer.length)return;const out=new Int16Array(this.buffer);this.port.postMessage({pcm:out.buffer,level:Math.sqrt(this.energy/Math.max(1,this.count))},[out.buffer]);this.buffer=[];this.energy=0;this.count=0;}
      process(inputs){const data=inputs[0]?.[0];if(!data)return true;const ratio=sampleRate/16000;
        for(const v of data){this.energy+=v*v;this.count++;let left=1;while(left>0){const take=Math.min(left,ratio-this.weight);this.sum+=v*take;this.weight+=take;left-=take;
          if(this.weight>=ratio-1e-8){this.buffer.push(Math.round(Math.max(-1,Math.min(1,this.sum/ratio))*32767));this.sum=0;this.weight=0;}
          if(this.buffer.length>=${16000*ASR_CHUNK_MS/1000})this.flush();
        }}return true;}}
      registerProcessor('jev-pcm',PCM);`;
    url = URL.createObjectURL(new Blob([code], {type:'application/javascript'}));
    await context.audioWorklet.addModule(url);
    worklet = new AudioWorkletNode(context, 'jev-pcm');
    if(options.sampleUrl){const response=await fetch(options.sampleUrl);if(!response.ok)throw Error('测试音频未加载');sample=context.createBufferSource();sample.buffer=await context.decodeAudioData(await response.arrayBuffer());sample.onended=()=>stopSession();source=sample}else source=context.createMediaStreamSource(stream!);
    const mute = context.createGain(); mute.gain.value = 0;
    source.connect(worklet); worklet.connect(mute).connect(context.destination); await context.resume();
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/asr`);
    let ready = false;
    socket.onopen = () => socket!.send(JSON.stringify({type:'start'}));
    socket.onmessage = event => { if(disposed)return; try { const data = JSON.parse(event.data) as ASREvent; if(data.type === 'ready'){ready = true;if(sample&&!sampleStarted){sampleStarted=true;sample.start()}}
      if((data.type==='partial'||data.type==='final')&&data.text){const now=performance.now(),key=`${data.segmentId}:${data.text.replace(/[^\p{L}\p{N}]/gu,'')}`;if(firstTextMs===null&&firstAudioAt!==undefined)firstTextMs=Math.round(now-firstAudioAt);if(data.type==='partial'&&key!==lastTranscript){updateGapMs=lastTextAt===undefined?null:Math.round(now-lastTextAt);lastTextAt=now;lastTranscript=key}data.timing={firstTextMs,updateGapMs,queueMs:Math.round((socket?.bufferedAmount||0)/32),chunkMs:ASR_CHUNK_MS};}
      onEvent(data); if(data.type === 'stopped' || data.type === 'error') dispose(); } catch { onEvent({type:'error', code:'ASR_PROTOCOL', message:'语音服务返回了无法读取的消息。'}); dispose(); } };
    socket.onerror = () => {if(disposed)return;onEvent({type:'error', code:'ASR_CONNECTION', message:'语音连接未建立，请检查本地服务。'}); dispose();};
    socket.onclose = () => { if (!disposed) {onEvent({type:'error',code:'ASR_CONNECTION_CLOSED',message:'语音连接意外中断，最后一段识别可能未完成。'}); dispose();} };
    const requestFinish=()=>{
      if(disposed||finishSent)return;finishSent=true;clearTimeout(flushTimer);
      if(socket?.readyState === WebSocket.OPEN){
        socket.send(JSON.stringify({type:'stop'}));
        closeTimer=setTimeout(()=>{if(disposed)return;onEvent({type:'error',code:'TIMEOUT',message:'等待最后一段语音识别超时，未收到结束确认。'});dispose();},ASR_STOP_TIMEOUT_MS);
      }else{
        onEvent({type:'error',code:'ASR_CONNECTION_CLOSED',message:'语音连接已断开，无法确认最后一段识别。'});dispose();
      }
    };
    worklet.port.onmessage = event => {
      if(disposed||finishSent)return;if(event.data.flushed){if(stopping)requestFinish();return}
      if(event.data.pcm&&ready&&socket?.readyState===WebSocket.OPEN){
       if(socket.bufferedAmount>ASR_MAX_QUEUE_BYTES){onEvent({type:'error',code:'AUDIO_BACKPRESSURE',message:'音频上传积压超过半秒，已停止录音；请检查网络后重试。'});dispose();return}
       firstAudioAt??=performance.now();socket.send(event.data.pcm);
      }
      const now=performance.now();if(!stopping&&now-lastLevelAt>80){lastLevelAt=now;onLevel(event.data.level);}
    };
    stopSession=()=>{
      if(disposed||stopping)return;stopping=true;stream?.getTracks().forEach(t=>t.stop());if(sample&&sampleStarted){sample.onended=null;sample.stop()}onLevel(0);
      if(worklet?.port.postMessage){flushTimer=setTimeout(requestFinish,100);worklet.port.postMessage({type:'flush'})}else requestFinish();
    };return {dispose,stop:stopSession};
  } catch (error) {dispose(); throw error;}
}
