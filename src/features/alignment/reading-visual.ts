export type ReadingRect={start:number;end:number;left:number;right:number;top:number;bottom:number};
export function scriptCharacters(text:string){let position=0;return [...text].map(char=>{const start=position;position+=char.length;return {char,start,end:position};});}
/** Geometry only: the caller supplies a position already supported by alignment. */
export function locateReadingLine(rects:ReadingRect[],position:number){
  if(!rects.length)return null;
  const focus=rects.find(rect=>position>rect.start&&position<=rect.end)??(position<=0?rects[0]:rects.at(-1)!);
  const row=rects.filter(rect=>Math.abs(rect.top-focus.top)<3);
  const left=Math.min(...row.map(rect=>rect.left)),right=Math.max(...row.map(rect=>rect.right));
  const top=Math.min(...row.map(rect=>rect.top)),bottom=Math.max(...row.map(rect=>rect.bottom));
  return {left,top,width:right-left,height:bottom-top,progress:position<=0?0:Math.min(right-left,Math.max(0,focus.right-left)),start:row[0].start,end:row.at(-1)!.end};
}
