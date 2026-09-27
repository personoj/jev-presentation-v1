import test from 'node:test';
import assert from 'node:assert/strict';
import {locateReadingCharacter,locateReadingLine,scriptCharacters,type ReadingRect} from '../src/features/alignment/reading-visual';
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

test('cursor advances by measured glyph widths and stays on the last spoken character at a line boundary',()=>{
  assert.equal(locateReadingCharacter(rects,0),null);
  const first=locateReadingCharacter(rects,1)!;
  const second=locateReadingCharacter(rects,2)!;
  assert.equal(first.character.start,0);assert.equal(first.progress,30);
  assert.equal(second.character.start,1);assert.equal(second.progress,60);
  assert.equal(locateReadingCharacter(rects,4)!.character.top,0);
  assert.equal(locateReadingCharacter(rects,5)!.character.top,60);
  assert.equal(locateReadingCharacter(rects,5)!.progress,30);
});

test('an unrendered newline holds the preceding glyph and emoji keeps its full UTF16 span',()=>{
  const chars:ReadingRect[]=[
    {start:0,end:1,left:0,right:31,top:0,bottom:40},
    {start:1,end:3,left:31,right:79,top:0,bottom:40},
    {start:4,end:5,left:0,right:35,top:74,bottom:114},
  ];
  assert.deepEqual(locateReadingCharacter(chars,3)!.character,{...chars[1],width:48,height:40});
  assert.equal(locateReadingCharacter(chars,4)!.character.start,1);
  assert.equal(locateReadingCharacter(chars,5)!.character.top,74);
  assert.equal(locateReadingCharacter([],12),null);
});
