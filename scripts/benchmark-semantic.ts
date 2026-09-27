import {writeFile,mkdir} from 'node:fs/promises';
import {loadConfig} from '../server/config.mjs';
import {createEvaluator} from '../server/evaluate.mjs';
import {ReadingProgress} from '../src/features/alignment/reading-progress';
import {acceptJudgment} from '../src/features/alignment/engine';
import {ALIGNMENT_QUESTION} from '../src/features/alignment/judgment';

const evaluate=createEvaluator(await loadConfig());
const script='我按稿件朗读，标记就跟随我的位置。';
const examples:[string,string,boolean][]=[
 ['同音错字','我按搞件朗读，标记就跟随我的位置。',true],
 ['近义表达','我照着稿子念，屏幕会标出我正在读的位置。',true],
 ['话题相关插话','这里我补充一下，语音识别有时候也会出现错误。',false],
 ['含义相反','我没有按照稿件朗读，标记也不会跟随我的位置。',false],
];
const results=[];
for(const [name,text,expected] of examples){
 const progress=new ReadingProgress();progress.begin(name);const candidate=progress.select(script,text,true);
 const output=await evaluate({requestId:crypto.randomUUID(),state:{transcript:text,localScript:script,candidate:candidate?.text??'',task:'语义跟读：允许错字、同音字与意思一致的近义表达；话题相关的插话不等于在读稿件。'},questions:{alignment:ALIGNMENT_QUESTION}});
 const answer=output.answers.alignment,accepted=acceptJudgment(candidate,answer.choice,answer.probabilities.match);
 const row={name,text,candidate,expected,accepted,answer,elapsedMs:output.elapsedMs,model:output.model};results.push(row);
 console.log(JSON.stringify(row));
}
await mkdir('qa/asr-selection',{recursive:true});await writeFile('qa/asr-selection/semantic-review.json',JSON.stringify(results,null,2));
if(results.some(r=>r.accepted!==r.expected))process.exitCode=1;
