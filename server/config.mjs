import { readFile } from 'node:fs/promises';
import {asrEndpoint} from './asr-protocol.mjs';
export const DEFAULT_MODELS = { jev: 'jev-latest', asr: 'qwen-audio-3.1-asr-flash-streaming', video: 'minimax/minimax-h3-max' };
export async function loadConfig(env = process.env) {
  let text = '';
  try { text = await readFile(env.API_KEYS_FILE || 'C:/Users/W/Desktop/apikey.txt', 'utf8'); } catch {}
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(Jev|ZenMux|DASHSCOPE_API_KEY)\s*[:：=]\s*([^\s]+)\s*$/i);
    if (match) values[match[1].toLowerCase()] = match[2];
  }
  return {
    keys: { jev: env.TYPESAFE_API_KEY || values.jev || '', asr: env.DASHSCOPE_API_KEY || values.dashscope_api_key || '', video: env.ZENMUX_API_KEY || values.zenmux || '' },
    models: { jev: env.JEV_MODEL || DEFAULT_MODELS.jev, asr: env.ASR_MODEL || DEFAULT_MODELS.asr, video: env.VIDEO_MODEL || DEFAULT_MODELS.video },
    asrUrl: env.ASR_WS_URL || asrEndpoint(env.ASR_MODEL || DEFAULT_MODELS.asr),
  };
}
