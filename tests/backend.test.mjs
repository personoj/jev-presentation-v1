import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createEvaluator, upstreamError, validateRequest, validateResponse } from '../server/evaluate.mjs';
import { createApp, localRequest } from '../server/index.mjs';
const payload={requestId:'test-1',stateVersion:2,state:'hello',questions:{yes:{type:'noul',instructions:'Is a greeting?'}}};
const response={model:'jev-1.13.0',answers:{yes:{type:'noul',noul:.98}},usage:{input_tokens:20,output_tokens:3}};
const config={keys:{jev:'private-test-key',asr:'',video:''},models:{jev:'jev-latest',asr:'qwen3-asr-flash-realtime',video:'test'}};
test('validates narrow API contract',()=>{
 assert.equal(validateRequest(payload),payload);
 assert.throws(()=>validateRequest({...payload,questions:{a:{type:'score',instructions:'degree',criteria:['only']}}}));
 assert.throws(()=>validateRequest({...payload,model:'https://malicious.test'}));
 assert.throws(()=>validateResponse({...response,answers:{}},payload.questions));
 assert.throws(()=>validateResponse({...response,answers:{yes:{type:'noul',noul:1.2}}},payload.questions));
});
test('distinguishes billing quota from transient rate limits',()=>{
 assert.equal(upstreamError(429,'rate limited').code,'RATE_LIMITED');
 assert.equal(upstreamError(429,'insufficient_quota').code,'QUOTA_EXCEEDED');
 assert.equal(upstreamError(402).code,'QUOTA_EXCEEDED');
});
test('forwards exact question contract and version, never emits secret',async()=>{
 let captured;
 const evaluate=createEvaluator(config,async(url,options)=>{captured={url,options};return Response.json(response);});
 const output=await evaluate(payload);
 assert.equal(output.stateVersion,2);assert.equal(output.source,'live');assert.deepEqual(output.answers,response.answers);
 assert.deepEqual(JSON.parse(captured.options.body),{model:'jev-latest',state:'hello',questions:payload.questions});
 assert.equal(JSON.stringify(output).includes(config.keys.jev),false);
});
test('quota circuit breaker prevents subsequent billed calls',async()=>{
 let calls=0;
 const evaluate=createEvaluator(config,async()=>{calls++;return new Response('insufficient_quota',{status:429});});
 await assert.rejects(evaluate(payload),e=>e.code==='QUOTA_EXCEEDED');
 await assert.rejects(evaluate(payload),e=>e.code==='QUOTA_EXCEEDED');assert.equal(calls,1);
});
test('local origin and host protection',()=>{
 assert.equal(localRequest({headers:{host:'evil.test'}}),false);
 assert.equal(localRequest({headers:{host:'127.0.0.1:4178',origin:'https://evil.test'}}),false);
 assert.equal(localRequest({headers:{host:'127.0.0.1:4178',origin:'http://localhost:5173'}}),true);
});
test('HTTP integration serves range while denying source paths and unsafe bodies',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'jev-backend-'));const dist=path.join(dir,'dist');const pub=path.join(dir,'public');
 await mkdir(dist);await mkdir(pub);await writeFile(path.join(dist,'index.html'),'<h1>Jev</h1>');await writeFile(path.join(pub,'clip.mp4'),'0123456789');
 const server=await createApp({config,fetcher:async()=>Response.json(response),distRoot:dist,publicRoot:pub});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const range=await fetch(base+'/clip.mp4',{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'2345');assert.equal(range.headers.get('content-range'),'bytes 2-5/10');
  assert.equal((await fetch(base+'/clip.mp4',{headers:{Range:'bytes=30-'}})).status,416);
  for(const p of ['/server/config.mjs','/.env','/src/App.tsx','/package.json','/node_modules'])assert.equal((await fetch(base+p)).status,404,p);
  assert.equal((await fetch(base+'/api/evaluate',{method:'POST',body:JSON.stringify(payload)})).status,415);
  const bad=await fetch(base+'/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});assert.equal(bad.status,400);
  const live=await fetch(base+'/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(live.status,200);assert.equal((await live.json()).stateVersion,2);
  const caps=await(await fetch(base+'/api/capabilities')).json();assert.equal(caps.jev,true);assert.equal(JSON.stringify(caps).includes(config.keys.jev),false);
  assert.equal((await fetch(base+'/api/capabilities',{headers:{Origin:'https://evil.test'}})).status,403);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
