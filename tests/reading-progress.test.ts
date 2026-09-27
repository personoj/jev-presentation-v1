import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ReadingProgress} from '../src/features/alignment/reading-progress';
import {findCandidate,findShortPreview,acceptJudgment,classifyCandidate} from '../src/features/alignment/engine';
const script='我们使用语音识别模型。\n把声音转换成文字。\n然后继续按照稿件朗读。';
const candidate=(p:ReadingProgress,text:string,s=script)=>findCandidate(s,text,p.anchor)??findShortPreview(s,text,p.anchor);

test('a shrinking ASR revision, rejected aside and final do not rewind the visible head',()=>{
 const p=new ReadingProgress();p.begin('a');p.preview(script,candidate(p,'我们使用语音'));const head=p.position;
 p.preview(script,candidate(p,'我们'));assert.equal(p.position,head);
 p.confirm(script,candidate(p,'我们使用'));assert.equal(p.position,head);assert.ok(p.confirmed<head);
 p.begin('aside');assert.equal(p.preview(script,candidate(p,'下面先停一下')),false);assert.equal(p.position,head);
});
test('a short exact phrase in a later sentence cannot make the cursor skip forward',()=>{
 const p=new ReadingProgress();p.begin('a');
 assert.equal(p.preview(script,candidate(p,'把声音转换')),false);assert.equal(p.position,0);
 assert.equal(p.confirm(script,candidate(p,'然后继续按照稿件朗读')),false);assert.equal(p.position,0);
});
test('segment locking prevents a revision from switching occurrences of repeated words',()=>{
 const s='今天我们来读一段文字。下一页我们来读另一个例子。',p=new ReadingProgress();p.begin('a');
 assert.equal(p.preview(s,candidate(p,'今天我们来读',s)),true);const head=p.position;
 assert.equal(p.preview(s,candidate(p,'我们来读另一个例子',s)),false);assert.equal(p.position,head);
});
test('old segment results are ignored after the next segment starts; reset explicitly rewinds',()=>{
 const p=new ReadingProgress();p.begin('a');p.confirm(script,candidate(p,'我们使用语音识别模型'));
 p.begin('b');p.preview(script,candidate(p,'把声音'));const head=p.position;
 assert.equal(p.begin('a'),false);assert.equal(p.position,head);p.reset();assert.equal(p.position,0);assert.equal(p.begin('a'),true);
});
test('fuzzy partials wait for semantic approval instead of moving speculatively',()=>{
 const p=new ReadingProgress();p.begin('a');const c=candidate(p,'我们使用语义识别模型');assert.ok(c&&!c.exact);
 assert.equal(p.preview(script,c),false);assert.equal(p.position,0);
 assert.equal(p.confirm(script,c,true),true);assert.equal(p.position,10);
});
test('recorded real cloud ASR revisions remain monotonic and resume after both asides',()=>{
 const trace=JSON.parse(fs.readFileSync(new URL('../qa/latency/after-40ms.json',import.meta.url),'utf8'));
 const p=new ReadingProgress();let previous=0;const finals:number[]=[];
 for(const event of trace.events){
  if(!['partial','final'].includes(event.type)||!event.text||!p.begin(event.segmentId))continue;
  const c=p.select(script,event.text,event.type==='final',event.stableText);
  if(event.type==='final'){p.confirm(script,c);finals.push(p.position)}else p.preview(script,c);
  assert.ok(p.position>=previous,`rewound on ${event.text}`);previous=p.position;
 }
 assert.deepEqual(finals,[10,20,20,20,32]);
});

test('reading a different sentence relocates only after two growing exact fragments',()=>{
 const p=new ReadingProgress();p.begin('a');p.confirm(script,candidate(p,'我们使用语音识别模型'));
 p.begin('jump');assert.equal(p.select(script,'然后继续按照',false),null);assert.equal(p.position,10);
 const target=p.select(script,'然后继续按照稿件',false);assert.ok(target);p.preview(script,target);
 assert.equal(p.position,30);
});
test('a deliberate reread can move backward without clicking reset',()=>{
 const p=new ReadingProgress();p.begin('later');p.confirm(script,p.select(script,'然后继续按照稿件朗读',true));assert.equal(p.position,32);
 p.begin('reread');assert.equal(p.select(script,'我们使用语音',false),null);assert.equal(p.position,32);
 p.preview(script,p.select(script,'我们使用语音识别',false));assert.equal(p.position,8);
 p.confirm(script,p.select(script,'我们使用语音识别模型',true));assert.equal(p.position,10);assert.equal(p.confirmed,10);
});
test('a stable exact phrase can recover globally beyond the old 45-character lookback',()=>{
 const s='今天我们来看一个跟读的小例子。'+'请你放慢语速读完这段文字。'.repeat(5)+'等你回到稿件它再接着往下走。';
 const p=new ReadingProgress();p.begin('last');p.confirm(s,p.select(s,'等你回到稿件它再接着往下走',true));assert.ok(p.position>60);
 p.begin('first');p.preview(s,p.select(s,'今天我们来看一个跟读',false,'今天我们来看一个'));assert.equal(p.position,10);
});
test('punctuation-only revisions cannot corroborate a jump',()=>{
 const p=new ReadingProgress();p.begin('a');
 assert.equal(p.select(script,'然后继续按照',false),null);
 assert.equal(p.select(script,'然后继续按照。',false),null);assert.equal(p.position,0);
});
test('the recent exact suffix recovers after an aside within one continuous ASR segment',()=>{
 const p=new ReadingProgress();p.begin('continuous');p.confirm(script,p.select(script,'我们使用语音识别模型',true));
 const target=p.select(script,'我们使用语音识别模型，这里补充一句题外话，然后继续按照稿件朗读',true);
 assert.ok(target?.exact);p.confirm(script,target);assert.equal(p.position,32);
});

test('a low-overlap paraphrase offers a local semantic hypothesis but cannot advance without approval',()=>{
 const s='我按稿件朗读，标记就跟随我的位置。\n等我回到原文，系统再继续跟随。';
 const p=new ReadingProgress();p.begin('semantic');const c=p.select(s,'我照着稿子念，屏幕会标出我正在读的位置。',true);
 assert.ok(c?.semantic);assert.equal(c.text,'我按稿件朗读，标记就跟随我的位置');
 assert.equal(classifyCandidate(c,'我照着稿子念，屏幕会标出我正在读的位置。'),'review');
 assert.equal(p.preview(s,c),false);assert.equal(p.position,0);
 assert.equal(acceptJudgment(c,'no_match',.99),false);assert.equal(acceptJudgment(c,'match',.69),false);
 assert.equal(acceptJudgment(c,'match',.99),true);assert.equal(p.confirm(s,c,true),true);assert.equal(p.position,16);
});

const presentation='接下来，我用跟读场景演示这套流程。\n我按稿件朗读，标记就跟随我的位置。\n如果我临时补充几句话，标记会停住。';
function nearEnd(){const p=new ReadingProgress();p.begin('later');p.confirm(presentation,p.select(presentation,'如果我临时补充几句话标记会停住',true));assert.ok(p.position>35);return p;}
test('one partial 接下来 immediately relocates to the unique three-character phrase',()=>{
 const p=nearEnd();p.begin('reread');const c=p.select(presentation,'接下来',false);
 assert.ok(c?.exact);assert.equal(c.text,'接下来');p.preview(presentation,c);assert.equal(p.position,3);
 p.preview(presentation,p.select(presentation,'接下来我用跟读',false));assert.equal(p.position,8);
});
test('repeated short phrases in one cumulative segment return without a full sentence or final',()=>{
 for(const text of ['接下来接下来','接下来，接下来。','我补充一句，接下来','如果我临时补充几句话标记会停住接下来']){
  const p=nearEnd();if(!text.startsWith('如果'))p.begin('repeat');p.preview(presentation,p.select(presentation,text,false));assert.equal(p.position,3,text);
 }
});
test('a short unique phrase can deliberately move backward within the same sentence',()=>{
 const p=new ReadingProgress();p.begin('a');p.confirm(presentation,p.select(presentation,'接下来我用跟读',true));
 p.begin('reread');p.preview(presentation,p.select(presentation,'我用跟读',false));assert.equal(p.position,8);
 p.begin('again');p.preview(presentation,p.select(presentation,'接下来',false));assert.equal(p.position,3);
});
test('a short ASR retraction does not masquerade as deliberate rereading',()=>{
 const p=new ReadingProgress();p.begin('a');p.preview(presentation,p.select(presentation,'接下来我用跟读',false));assert.equal(p.position,8);
 p.preview(presentation,p.select(presentation,'接下来',false));assert.equal(p.position,8);
 p.preview(presentation,p.select(presentation,'接下来接下来',false));assert.equal(p.position,3,'actual repetition is fresh evidence');
});
test('ambiguous short phrases and isolated two-character words do not relocate',()=>{
 const s='接下来介绍模型。\n接下来介绍应用。\n最后完成演示。',p=new ReadingProgress();p.begin('last');p.confirm(s,p.select(s,'最后完成演示',true));const before=p.position;
 p.begin('ambiguous');p.preview(s,p.select(s,'接下来',false));assert.equal(p.position,before);
 p.begin('too-short');p.preview(s,p.select(s,'模型',false));assert.equal(p.position,before);
});
test('a corrected cumulative prefix continues from a short word without getting locked out',()=>{
 const p=new ReadingProgress();p.begin('a');p.select(presentation,'我案搞',false);
 p.preview(presentation,p.select(presentation,'我案搞件朗读',false));assert.equal(p.position,24);
 p.preview(presentation,p.select(presentation,'我按稿件朗读，标',false));assert.equal(p.position,26);
 p.preview(presentation,p.select(presentation,'我按稿件朗读，标记就跟随',false));assert.equal(p.position,30);
});
