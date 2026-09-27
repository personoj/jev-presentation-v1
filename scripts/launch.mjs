import {stat, mkdir, open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const APP_URL = 'http://127.0.0.1:4178/';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export class LaunchError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
export function isApplicationCapabilities(value){
  return value !== null && typeof value === 'object'
    && ['jev','asr','video'].every(key=>typeof value[key] === 'boolean')
    && value.configuredModels !== null && typeof value.configuredModels === 'object'
    && typeof value.configuredModels.jev === 'string' && value.configuredModels.jev.startsWith('jev-')
    && typeof value.configuredModels.asr === 'string' && value.configuredModels.asr.length>0
    && typeof value.configuredModels.video === 'string' && value.configuredModels.video.length>0;
}
export async function probeApplication(fetcher=fetch){
  try{
    const response=await fetcher(`${APP_URL}api/capabilities`,{signal:AbortSignal.timeout(1200),redirect:'manual'});
    if(!response.ok)return 'occupied';
    let value;try{value=await response.json();}catch{return 'occupied';}
    return isApplicationCapabilities(value)?'ready':'occupied';
  }catch(error){
    // A listener which hangs is occupied, not a licence to replace it.
    return error?.cause?.code==='ECONNREFUSED'||error?.code==='ECONNREFUSED'?'stopped':'occupied';
  }
}
export async function spawnServer(root,spawnImpl=spawn){
  const logDir=path.join(root,'.local');await mkdir(logDir,{recursive:true});
  const log=await open(path.join(logDir,'server.log'),'a');
  try{
    const child=spawnImpl(process.execPath,[path.join(root,'server','index.mjs')],{
      cwd:root,env:{...process.env,PORT:'4178'},detached:true,windowsHide:true,
      shell:false,stdio:['ignore',log.fd,log.fd],
    });
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
    child.unref();
  }finally{await log.close();}
}
export async function openDefaultBrowser(url=APP_URL,spawnImpl=spawn,platform=process.platform){
  let command,args;
  if(platform==='win32'){command='rundll32.exe';args=['url.dll,FileProtocolHandler',url];}
  else if(platform==='darwin'){command='open';args=[url];}
  else{command='xdg-open';args=[url];}
  const child=spawnImpl(command,args,{detached:true,windowsHide:true,shell:false,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.unref();
}
export async function launchPresentation(options={}){
  const root=options.root||projectRoot;
  const hasBuild=options.hasBuild|| (async()=>{try{return (await stat(path.join(root,'dist','index.html'))).isFile();}catch{return false;}});
  const probe=options.probe||probeApplication,start=options.start||(()=>spawnServer(root));
  const openBrowser=options.openBrowser||openDefaultBrowser;
  const delay=options.delay||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  const attempts=options.attempts??30;
  if(!await hasBuild())throw new LaunchError('BUILD_REQUIRED','没有找到正式构建 dist/index.html。请在项目目录运行 npm run build 后，再双击启动。');
  const initial=await probe();
  if(initial==='occupied')throw new LaunchError('PORT_OCCUPIED','本机 4178 端口被其他程序占用或没有正常响应。本启动器不会关闭任何进程，请检查占用后重试。');
  if(initial!=='ready'){
    try{await start();}catch{throw new LaunchError('START_FAILED','无法启动本机服务，请检查 .local/server.log。');}
    let ready=false;
    for(let attempt=0;attempt<attempts;attempt++){
      await delay(250);
      const state=await probe();
      if(state==='ready'){ready=true;break;}
      if(state==='occupied')throw new LaunchError('PORT_OCCUPIED','4178 端口没有返回本应用信息。请检查 .local/server.log；启动器不会结束占用进程。');
    }
    if(!ready)throw new LaunchError('READY_TIMEOUT','本机服务未在等待时间内启动，请检查 .local/server.log。没有打开未就绪的页面。');
  }
  try{await openBrowser(APP_URL);}catch{throw new LaunchError('BROWSER_FAILED',`展示服务已就绪，但浏览器未能自动打开。请手动访问 ${APP_URL}`);}
  return {url:APP_URL,reused:initial==='ready'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await launchPresentation();
    console.log(`${result.reused?'展示已运行，已打开浏览器':'展示已启动'}：${result.url}`);
  }catch(error){
    console.error(error instanceof LaunchError?error.message:'启动遇到错误，请检查本机 Node.js 和项目文件。');
    process.exitCode=1;
    if(process.stdin.isTTY){const {createInterface}=await import('node:readline/promises');const input=createInterface({input:process.stdin,output:process.stdout});await input.question('按回车关闭此窗口…');input.close();}
  }
}
