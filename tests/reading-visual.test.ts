import test from 'node:test';
import assert from 'node:assert/strict';
import {locateReadingLine,scriptCharacters,type ReadingRect} from '../src/features/alignment/reading-visual';
const rects:ReadingRect[]=Array.from({length:8},(_,i)=>({start:i,end:i+1,left:(i%4)*30,right:(i%4+1)*30,top:i<4?0:60,bottom:i<4?36:96}));
test('reading geometry follows the supplied partial position within one actual line',()=>{
  const focus=locateReadingLine(rects,2)!;
  assert.equal(focus.top,0);assert.equal(focus.progress,60);assert.equal(focus.width,120);assert.deepEqual([focus.start,focus.end],[0,4]);
});
test('line boundary stays on the last spoken character and moves only with next character',()=>{
  assert.equal(locateReadingLine(rects,4)!.top,0);
  const next=locateReadingLine(rects,5)!;assert.equal(next.top,60);assert.equal(next.progress,30);
});
test('responsive reflow locates the same supported position on its new physical line',()=>{
  const narrow=rects.map((rect,i)=>({...rect,left:(i%2)*30,right:(i%2+1)*30,top:Math.floor(i/2)*60,bottom:Math.floor(i/2)*60+36}));
  assert.equal(locateReadingLine(rects,5)!.top,60);assert.equal(locateReadingLine(narrow,5)!.top,120);
  assert.equal(locateReadingLine(narrow,5)!.progress,30);
});
test('empty script has no fabricated focus and beginning has zero underline progress',()=>{
  assert.equal(locateReadingLine([],0),null);assert.equal(locateReadingLine(rects,0)!.progress,0);
});
test('character spans preserve UTF16 offsets used by the alignment engine',()=>{
  assert.deepEqual(scriptCharacters('语音📖。'),[{char:'语',start:0,end:1},{char:'音',start:1,end:2},{char:'📖',start:2,end:4},{char:'。',start:4,end:5}]);
});
