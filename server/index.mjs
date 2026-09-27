import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadConfig } from './config.mjs';
import { createEvaluator, AppError } from './evaluate.mjs';
import { createAsrRelay } from './asr.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.ico':'image/x-icon','.wav':'audio/wav','.mp3':'audio/mpeg','.pcm':'application/octet-stream'};
export function localRequest(req) {
  if (!/^((localhost|127\.0\.0\.1)(:\d+)?|\[::1\](:\d+)?)$/i.test(req.headers.host || '')) return false;
  if (!req.headers.origin) return true;
  try { const origin = new URL(req.headers.origin); return ['http:','https:'].includes(origin.protocol) && ['localhost','127.0.0.1','[::1]'].includes(origin.hostname) && ['4178','5178','5173','4173'].includes(origin.port); } catch { return false; }
}
function json(res, status, body) { if (res.destroyed || res.writableEnded) return; res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(body)); }
async function bodyJSON(req) {
  let total = 0; const chunks = [];
  for await (const chunk of req) { total += chunk.length; if (total > 512 * 1024) throw new AppError('BODY_TOO_LARGE','请求超过 512KB 限制。',413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('BAD_JSON','请求必须是有效 JSON。',400); }
}
async function staticFile(req, res, distRoot, publicRoot) {
  let pathname; try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return json(res,400,{code:'BAD_PATH',message:'无效路径。'}); }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(p => p.startsWith('.'))) return json(res,404,{code:'NOT_FOUND',message:'未找到文件。'});
  let chosen, info;
  for (const directory of [distRoot, publicRoot]) {
    const candidate = path.resolve(directory, '.'+pathname);
    if (!candidate.startsWith(directory + path.sep) && candidate !== directory) continue;
    try {
      const actual = await realpath(candidate);
      if (!actual.startsWith(directory + path.sep)) continue;
      const s = await stat(actual); if (s.isFile() && mime[path.extname(actual)]) {chosen=actual;info=s;break;}
    } catch {}
  }
  if (!chosen && (pathname === '/' || (!path.extname(pathname) && !/^\/(api|server|src|source|tests|node_modules)(\/|$)/.test(pathname)))) {
    try { chosen = path.join(distRoot, 'index.html'); info=await stat(chosen); } catch { return json(res,503,{code:'BUILD_REQUIRED',message:'请先执行 npm run build，然后启动展示。'}); }
  }
  if (!chosen) return json(res,404,{code:'NOT_FOUND',message:'未找到文件。'});
  const headers = {'Content-Type':mime[path.extname(chosen)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Cache-Control':'no-cache','Referrer-Policy':'same-origin'};
  let start = 0, end = info.size - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
    if (!match[1]) {start=Math.max(0,info.size-Number(match[2]));} else {start=Number(match[1]); if(match[2]) end=Math.min(end,Number(match[2]));}
    if(start>end || start>=info.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
  if(req.method==='HEAD'||info.size===0){res.end();return;}
  const stream=createReadStream(chosen,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
export async function createApp(options = {}) {
  const config = options.config || await loadConfig();
  const evaluate = createEvaluator(config, options.fetcher);
  let activeEvaluations=0;
  const server = http.createServer(async (req,res) => {
    if(!localRequest(req)) return json(res,403,{code:'ORIGIN_DENIED',message:'仅允许本机展示页面访问。'});
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/api/capabilities' && req.method==='GET') return json(res,200,{jev:!!config.keys.jev,asr:!!config.keys.asr,video:!!config.keys.video,configuredModels:config.models});
    if(pathname==='/api/evaluate' && req.method==='POST') {
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) return json(res,415,{code:'CONTENT_TYPE',message:'请使用 application/json。'});
      if(activeEvaluations>=8) return json(res,429,{code:'RATE_LIMITED',message:'本地已有多个判断正在运行，请稍后重试。'});
      const controller=new AbortController(); const timer=setTimeout(()=>controller.abort('timeout'),30000);
      const abort=()=>{if(!res.writableEnded)controller.abort('client closed');};res.on('close',abort);activeEvaluations++;
      try { const payload=await bodyJSON(req); const result=await evaluate(payload,controller.signal);json(res,200,result); }
      catch(error) { const timed=controller.signal.aborted; json(res,timed?504:error.status||502,{code:timed?'TIMEOUT':error.code||'CONNECTION_FAILED',message:timed?'模型请求已超时或取消。':error instanceof AppError?error.message:'无法连接模型服务，请检查网络。'}); }
      finally {clearTimeout(timer);res.off('close',abort);activeEvaluations--;}
      return;
    }
    if(pathname.startsWith('/api/')) return json(res,404,{code:'NOT_FOUND',message:'接口不存在。'});
    if(!['GET','HEAD'].includes(req.method)) return json(res,405,{code:'METHOD_NOT_ALLOWED',message:'不支持此请求方式。'});
    try {await staticFile(req,res,options.distRoot||path.join(root,'dist'),options.publicRoot||path.join(root,'public'));}catch{json(res,500,{code:'STATIC_ERROR',message:'无法读取展示文件。'});}
  });
  const wss = new WebSocketServer({noServer:true,maxPayload:65536}); const relay=createAsrRelay(config);
  server.on('upgrade',(req,socket,head)=>{
    if(!localRequest(req)||new URL(req.url,'http://localhost').pathname!=='/api/asr'||wss.clients.size>=2){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,client=>relay(client));
  });
  server.on('close',()=>{for(const client of wss.clients)client.terminate();wss.close();});
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server=await createApp();const port=Number(process.env.PORT||4178);
  server.listen(port,'127.0.0.1',()=>console.log(`Jev presentation: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{server.close();setTimeout(()=>process.exit(0),1000).unref();});
}

