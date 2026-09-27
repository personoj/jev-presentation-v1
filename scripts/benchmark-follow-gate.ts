import {writeFile,mkdir} from 'node:fs/promises';
import {loadConfig} from '../server/config.mjs';
import {createEvaluator} from '../server/evaluate.mjs';
import {Teleprompter,FollowGate} from '../src/features/alignment/teleprompter';
import {FOLLOWING_QUESTION} from '../src/features/alignment/judgment';
const evaluate=createEvaluator(await loadConfig());
const script='接下来，我用跟读场景演示这套流程。\n我按稿件朗读，标记就跟随我的位置。\n如果我临时补充几句话，标记会停住。';
const cases:[string,string,number,boolean][]=[
 ['正常朗读','接下来我用跟读场景演示这套流程',0,true],
 ['同音错字','我按搞件朗读，标记就跟随我的位置',18,true],
 ['近义表达','我照着稿子念，屏幕会标出我正在读的位置',18,true],
 ['引用开场词的插话','接下来我补充一下，大家有没有用过这种软件？',34,false],
 ['短语回读','接下来',34,true],
 ['意思相反','我没有按稿件朗读，标记也不会跟随我的位置',18,false],
];
const results=[];
for(const [name,text,start,expected] of cases){
 const tracker=new Teleprompter(),gate=new FollowGate();tracker.seek(start);gate.decide(.9);
 const update=tracker.propose(script,text,true,name)!;
 const state={transcript:text,manuscript:script,localAlignedText:update.candidate?.text??'',recentTranscripts:[]};
 const output=await evaluate({requestId:crypto.randomUUID(),state,questions:{following:FOLLOWING_QUESTION}});
 gate.decide(output.answers.following.noul);const accepted=gate.mayTrack(update,true);if(accepted)tracker.commit(update);
 const row={name,expected,accepted,localCandidate:update.candidate,position:tracker.position,state,output};results.push(row);console.log(JSON.stringify({name,expected,accepted,position:tracker.position,probability:gate.probability}));
}
await mkdir('qa/follow-gate',{recursive:true});await writeFile('qa/follow-gate/live-jev.json',JSON.stringify(results,null,2));
if(results.some(r=>r.expected!==r.accepted))process.exitCode=1;
