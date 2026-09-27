import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,rm,rmdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {APP_URL,launchPresentation,probeApplication,openDefaultBrowser,spawnServer} from '../scripts/launch.mjs';

const capabilities={jev:true,asr:true,video:true,configuredModels:{jev:'jev-latest',asr:'qwen3-asr-flash-realtime',video:'minimax/minimax-h3-max'}};
function scenario(states){
 const calls={start:0,opened:[],probes:0,delays:0};
 return {calls,options:{hasBuild:async()=>true,probe:async()=>{calls.probes++;return states.shift()||'stopped';},start:async()=>{calls.start++;},openBrowser:async url=>{calls.opened.push(url);},delay:async()=>{calls.delays++;}}};
}
test('missing dist prevents every network, process and browser action',async()=>{
 const {calls,options}=scenario(['ready']);options.hasBuild=async()=>false;
 await assert.rejects(launchPresentation(options),error=>error.code==='BUILD_REQUIRED');
 assert.deepEqual(calls,{start:0,opened:[],probes:0,delays:0});
});
test('existing verified application is reused without a second process',async()=>{
 const {calls,options}=scenario(['ready']);const result=await launchPresentation(options);
 assert.equal(result.reused,true);assert.equal(calls.start,0);assert.deepEqual(calls.opened,[APP_URL]);
});
test('cold launch waits for identified readiness before opening the browser',async()=>{
 const {calls,options}=scenario(['stopped','stopped','ready']);const result=await launchPresentation(options);
 assert.equal(result.reused,false);assert.equal(calls.start,1);assert.equal(calls.delays,2);assert.deepEqual(calls.opened,[APP_URL]);
});
test('unrelated port occupant is preserved and not opened',async()=>{
 const {calls,options}=scenario(['occupied']);
 await assert.rejects(launchPresentation(options),error=>error.code==='PORT_OCCUPIED');
 assert.equal(calls.start,0);assert.deepEqual(calls.opened,[]);
});
test('readiness polling is bounded and never opens an unready page',async()=>{
 const {calls,options}=scenario(['stopped']);
 await assert.rejects(launchPresentation({...options,attempts:3}),error=>error.code==='READY_TIMEOUT');
 assert.equal(calls.start,1);assert.equal(calls.probes,4);assert.deepEqual(calls.opened,[]);
});
test('probe distinguishes this app, unrelated listener, refusal and hanging listener',async()=>{
 assert.equal(await probeApplication(async()=>Response.json(capabilities)),'ready');
 assert.equal(await probeApplication(async()=>Response.json({ok:true})),'occupied');
 assert.equal(await probeApplication(async()=>new Response('other app',{status:404})),'occupied');
 assert.equal(await probeApplication(async()=>{throw Object.assign(new Error('refused'),{cause:{code:'ECONNREFUSED'}});}),'stopped');
 assert.equal(await probeApplication(async()=>{throw new DOMException('timeout','TimeoutError');}),'occupied');
});
test('Windows browser launch uses an argument array with hidden window, never shell interpolation',async()=>{
 let observed,unref=false;
 await openDefaultBrowser(APP_URL,(command,args,options)=>{observed={command,args,options};const child=new EventEmitter();child.unref=()=>{unref=true;};queueMicrotask(()=>child.emit('spawn'));return child;},'win32');
 assert.equal(observed.command,'rundll32.exe');assert.deepEqual(observed.args,['url.dll,FileProtocolHandler',APP_URL]);
 assert.equal(observed.options.windowsHide,true);assert.equal(observed.options.shell,false);assert.equal(unref,true);
});
test('server launch uses current Node, formal server entry and local log descriptors',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'jev-launcher-'));
 t.after(async()=>{await rm(path.join(root,'.local','server.log'));await rmdir(path.join(root,'.local'));await rmdir(root);});
 let observed;
 await spawnServer(root,(command,args,options)=>{observed={command,args,options};const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;});
 assert.equal(observed.command,process.execPath);assert.deepEqual(observed.args,[path.join(root,'server','index.mjs')]);
 assert.equal(observed.options.env.PORT,'4178');assert.equal(observed.options.detached,true);assert.equal(observed.options.windowsHide,true);assert.equal(observed.options.shell,false);
 assert.equal(typeof observed.options.stdio[1],'number');assert.equal(observed.options.stdio[1],observed.options.stdio[2]);
});
