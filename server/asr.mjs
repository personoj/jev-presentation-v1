import WebSocket from 'ws';
import {asrProtocol} from './asr-protocol.mjs';
import { upstreamError } from './evaluate.mjs';
export function createAsrRelay(config, WebSocketImpl = WebSocket) {
  let quotaStopped = false;
  return function relay(client) {
    const protocol=asrProtocol(config.models.asr);
    let upstream, started = false, ready = false, stopping = false, finished = false;
    let connectTimer, finishTimer,lastPartial='';
    const send = value => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(value)); };
    const upstreamSend = value => { if (upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify(value)); };
    const cleanup = () => { clearTimeout(connectTimer); clearTimeout(finishTimer); clearTimeout(sessionTimer); if (upstream && upstream.readyState !== WebSocket.CLOSED) upstream.terminate(); };
    const fail = error => {
      if (finished) return;
      finished = true;
      if (error.code === 'QUOTA_EXCEEDED') { quotaStopped = true; console.error('[ASR] QUOTA_EXCEEDED: subsequent calls disabled until restart.'); }
      send({ type: 'error', code: error.code, message: error.message }); cleanup(); client.close(1011, 'ASR failed');
    };
    const sessionTimer = setTimeout(() => fail({code:'SESSION_TIMEOUT',message:'语音会话达到 20 分钟，请重新开始。'}), 20 * 60 * 1000);
    connectTimer = setTimeout(() => fail({ code: 'TIMEOUT', message: '语音会话初始化超时。' }), 15000);
    client.on('message', (data, binary) => {
      if (finished) return;
      if (binary) {
        if (!ready || stopping) return;
        if (data.length > 65536 || data.length % 2 !== 0) return fail({code:'BAD_AUDIO',message:'请发送 PCM16 单声道 16kHz 音频块。'});
        if (upstream.bufferedAmount > 24000) return fail({code:'AUDIO_BACKPRESSURE',message:'云端音频发送积压，请检查网络后重新开始录音。'});
        upstream.send(protocol.audio(data));
        return;
      }
      let message; try { message = JSON.parse(data.toString()); } catch { return fail({code:'BAD_REQUEST',message:'语音控制消息必须为 JSON。'}); }
      if (message.type === 'start') {
        if (started) return;
        started = true;
        if (!config.keys.asr) return fail({code:'NOT_CONFIGURED',message:'未配置千问 ASR 密钥。'});
        if (quotaStopped) return fail(upstreamError(402));
        const url = new URL(config.asrUrl); if(!protocol.task)url.searchParams.set('model', config.models.asr);
        upstream = new WebSocketImpl(url, { headers: { Authorization: `Bearer ${config.keys.asr}`, 'OpenAI-Beta': 'realtime=v1' }, handshakeTimeout: 12000, maxPayload: 1024 * 1024 });
        upstream.on('open', () => upstreamSend(protocol.start()));
        upstream.on('unexpected-response', (_req, response) => {
          let body = ''; response.on('data', d => { if (body.length < 16000) body += d; }); response.on('end', () => fail(upstreamError(response.statusCode, body)));
        });
        upstream.on('message', raw => {
          let event; try { event = JSON.parse(raw.toString()); } catch { return fail({code:'INVALID_RESPONSE',message:'语音服务返回格式异常。'}); }
          const result=protocol.read(event);if(!result||finished)return;
          if(result.type==='ready'){ready=true;clearTimeout(connectTimer);send(result)}
          if(result.type==='partial'){const key=JSON.stringify([result.segmentId,result.text,result.stableText]);if(key!==lastPartial){lastPartial=key;send(result)}}
          if(result.type==='final')send(result);
          if(result.type==='provider-error')fail(upstreamError(0,result.error));
          if(result.type==='stopped'){finished=true;send(result);cleanup();client.close(1000)}
        });
        upstream.on('error', () => fail({code:'CONNECTION_FAILED',message:'无法连接千问语音服务，请检查网络与服务地域。'}));
        upstream.on('close', () => { if (!finished) fail({code:'CONNECTION_CLOSED',message:'语音服务连接已中断，请重新开始。'}); });
      } else if (message.type === 'stop') {
        if (stopping) return;
        stopping = true;
        if (!ready) { finished = true; send({type:'stopped'}); cleanup(); client.close(1000); return; }
        upstreamSend(protocol.stop());
        finishTimer = setTimeout(() => fail({code:'TIMEOUT',message:'语音服务结束确认超时。'}),15000);
      } else fail({code:'BAD_REQUEST',message:'未知语音控制消息。'});
    });
    client.on('close', () => { finished = true; cleanup(); });
    client.on('error', () => { finished = true; cleanup(); });
  };
}
