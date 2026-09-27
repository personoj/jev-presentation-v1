import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptJudgment, classifyCandidate, commitPosition, DEFAULT_SCRIPT, findCandidate, Freshness, normalized} from '../src/features/alignment/engine';
test('normalization retains original positions for punctuation-aware highlight',()=>{assert.deepEqual(normalized('语音，ASR。'),{text:'语音asr',positions:[0,1,3,4,5]});});
test('verbatim reading aligns its ordered span',()=>{const c=findCandidate(DEFAULT_SCRIPT,'我们使用语音识别模型，把声音转换成文字。',0);assert.ok(c);assert.equal(c.exact,true);assert.equal(c.end,19);assert.equal(classifyCandidate(c,'我们使用语音识别模型，把声音转换成文字。'),'exact');});
test('one recognition substitution is a review candidate, not unrestricted rewrite',()=>{const c=findCandidate(DEFAULT_SCRIPT,'我们使用语义识别模型，把声音转换成文字。',0);assert.ok(c);assert.ok(c.similarity>.9);assert.equal(c.end,19);assert.equal(classifyCandidate(c,'我们使用语义识别模型，把声音转换成文字。'),'review');});
test('a related aside does not pass the ordered local matcher',()=>{const s='这里我补充一下，这个演示用的是流式语音识别，大家可以看一下效果。';const c=findCandidate(DEFAULT_SCRIPT,s,21);assert.equal(classifyCandidate(c,s),'pause');});
test('repeat never pushes the confirmed location backward',()=>{const c=findCandidate(DEFAULT_SCRIPT,'把声音转换成文字',21);assert.ok(c);assert.equal(commitPosition(21,c.end),21);});
test('returning from an aside finds the next manuscript sentence',()=>{const s='程序结合稿件中的前后内容，判断当前读到了什么位置。';const c=findCandidate(DEFAULT_SCRIPT,s,21);assert.ok(c);assert.equal(c.exact,true);assert.equal(c.text,s.slice(0,-1));assert.ok(c.end>21);});
test('small omissions remain ordered local candidates',()=>{const s='程序结合稿件前后内容，判断当前读到什么位置';const c=findCandidate(DEFAULT_SCRIPT,s,21);assert.ok(c);assert.ok(c.similarity>.8);assert.equal(classifyCandidate(c,s),'review');});
test('short transcript waits for evidence',()=>{assert.equal(classifyCandidate(findCandidate(DEFAULT_SCRIPT,'语音',0),'语音'),'short');});
test('late model replies and resets cannot mutate newer state',()=>{const f=new Freshness();const first=f.next(),second=f.next();assert.equal(f.isCurrent(first),false);assert.equal(f.isCurrent(second),true);f.next();assert.equal(f.isCurrent(second),false);});
test('high lexical agreement plus live observed moderate semantic probability can accept a local error',()=>{const c=findCandidate(DEFAULT_SCRIPT,'我们使用语义识别模型，把声音转换成文字。',0);assert.equal(acceptJudgment(c,'match',0.63),true);assert.equal(acceptJudgment(c,'match',0.59),true);assert.equal(acceptJudgment(c,'match',0.5),false);assert.equal(acceptJudgment(c,'match',0.49),false);assert.equal(acceptJudgment(c,'no_match',0.99),false);});
test('semantic confidence cannot override unrelated lexical evidence',()=>{const c=findCandidate(DEFAULT_SCRIPT,'这里我补充一下，这个演示用的是流式语音识别，大家可以看一下效果。',0);assert.equal(acceptJudgment(c,'match',0.99),false);});


