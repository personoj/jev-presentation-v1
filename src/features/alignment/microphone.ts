type ASREvent = {type: 'partial' | 'final' | 'ready' | 'error' | 'stopped'; text?: string; segmentId?: string; code?: string; message?: string};
// The relay drains for 15 seconds; allow its final transcript and terminal event to arrive.
export const ASR_STOP_TIMEOUT_MS = 17000;
export type MicrophoneSession = {stop: () => void; dispose: () => void};
export async function openMicrophone(onEvent: (event: ASREvent) => void, onLevel: (level: number) => void): Promise<MicrophoneSession> {
  const stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true}, video: false});
  let context: AudioContext | undefined, socket: WebSocket | undefined, worklet: AudioWorkletNode | undefined, source: MediaStreamAudioSourceNode | undefined;
  let url = '', disposed = false, stopping = false, lastLevelAt = 0, closeTimer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { if (disposed) return; disposed = true; clearTimeout(closeTimer); stream.getTracks().forEach(t => t.stop()); source?.disconnect(); worklet?.disconnect(); if (context?.state !== 'closed') void context?.close(); socket?.close(); if (url) URL.revokeObjectURL(url); onLevel(0); };
  try {
    context = new AudioContext();
    // The worklet integrates input samples into 16 kHz bins; fractional bins persist across blocks.
    const code = `class PCM extends AudioWorkletProcessor {
      constructor(){super();this.sum=0;this.weight=0;this.buffer=[];this.energy=0;this.count=0;}
      process(inputs){const data=inputs[0]?.[0];if(!data)return true;const ratio=sampleRate/16000;
        for(const v of data){this.energy+=v*v;this.count++;let left=1;while(left>0){const take=Math.min(left,ratio-this.weight);this.sum+=v*take;this.weight+=take;left-=take;
          if(this.weight>=ratio-1e-8){this.buffer.push(Math.round(Math.max(-1,Math.min(1,this.sum/ratio))*32767));this.sum=0;this.weight=0;}
          if(this.buffer.length>=1600){const out=new Int16Array(this.buffer);this.port.postMessage({pcm:out.buffer,level:Math.sqrt(this.energy/Math.max(1,this.count))},[out.buffer]);this.buffer=[];this.energy=0;this.count=0;}
        }}return true;}}
      registerProcessor('jev-pcm',PCM);`;
    url = URL.createObjectURL(new Blob([code], {type:'application/javascript'}));
    await context.audioWorklet.addModule(url);
    worklet = new AudioWorkletNode(context, 'jev-pcm'); source = context.createMediaStreamSource(stream);
    const mute = context.createGain(); mute.gain.value = 0;
    source.connect(worklet); worklet.connect(mute).connect(context.destination); await context.resume();
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/asr`);
    let ready = false;
    socket.onopen = () => socket!.send(JSON.stringify({type:'start'}));
    socket.onmessage = event => { if(disposed)return; try { const data = JSON.parse(event.data) as ASREvent; if(data.type === 'ready') ready = true; onEvent(data); if(data.type === 'stopped' || data.type === 'error') dispose(); } catch { onEvent({type:'error', code:'ASR_PROTOCOL', message:'语音服务返回了无法读取的消息。'}); dispose(); } };
    socket.onerror = () => {if(disposed)return;onEvent({type:'error', code:'ASR_CONNECTION', message:'语音连接未建立，请检查本地服务。'}); dispose();};
    socket.onclose = () => { if (!disposed) {onEvent({type:'error',code:'ASR_CONNECTION_CLOSED',message:'语音连接意外中断，最后一段识别可能未完成。'}); dispose();} };
    worklet.port.onmessage = event => { if(disposed||stopping) return; if(ready && socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 1024 * 1024) socket.send(event.data.pcm); const now=performance.now(); if(now-lastLevelAt>80){lastLevelAt=now;onLevel(event.data.level);} };
    return {dispose, stop: () => {
      if(disposed||stopping)return;
      stopping=true;stream.getTracks().forEach(t => t.stop());onLevel(0);
      if(socket?.readyState === WebSocket.OPEN){
        socket.send(JSON.stringify({type:'stop'}));
        closeTimer=setTimeout(()=>{if(disposed)return;onEvent({type:'error',code:'TIMEOUT',message:'等待最后一段语音识别超时，未收到结束确认。'});dispose();},ASR_STOP_TIMEOUT_MS);
      }else{
        onEvent({type:'error',code:'ASR_CONNECTION_CLOSED',message:'语音连接已断开，无法确认最后一段识别。'});dispose();
      }
    }};
  } catch (error) {dispose(); throw error;}
}
