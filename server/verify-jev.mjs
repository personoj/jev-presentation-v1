import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config.mjs';
import { createEvaluator } from './evaluate.mjs';
const config=await loadConfig();
const request={requestId:'live-verification-20260922',stateVersion:1,state:{reader_comment:'延长图书馆开放时间很好，但回家的末班车太早，我可能还是参加不了。'},questions:{stance:{type:'choice',instructions:'读者对延长开放时间这项措施表达了什么态度？',criteria:{support:'支持延长开放时间',oppose:'反对延长开放时间',unclear:'未明确表达态度'}},transport:{type:'noul',instructions:'读者是否明确表达了交通方面的顾虑？'},participation:{type:'score',instructions:'根据原文，读者实际参与晚间活动的意愿有多强？不要把对政策的支持当成参与意愿。',criteria:['明确不会参加或大概率不能参加','尚不确定是否参加','明确计划或承诺参加']}}};
try {
 const output=await createEvaluator(config)(request,AbortSignal.timeout(30000));
 await writeFile(new URL('./evidence/jev-live.json',import.meta.url),JSON.stringify({testedAt:new Date().toISOString(),request,response:output,docs:['https://docs.typesafe.ai/api','https://docs.typesafe.ai/primitives/choice','https://docs.typesafe.ai/primitives/score','https://docs.typesafe.ai/primitives/noul']},null,2));
 console.log(JSON.stringify({model:output.model,answers:output.answers,elapsedMs:output.elapsedMs,usage:output.usage}));
} catch(e) {console.log(JSON.stringify({code:e.code||'CONNECTION_FAILED',message:e.code?e.message:'Live request failed'}));process.exitCode=1;}
