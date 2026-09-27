import {findCandidate,findExactReadingTail,findShortPreview,findSemanticCandidate,normalized,type Candidate} from './engine';

/** Hold through ASR retractions, but relocate when sustained lexical evidence
 * identifies a deliberate reread or a different place in the manuscript. */
export class ReadingProgress {
 position=0;
 confirmed=0;
 anchor=0;
 private id='';
 private retired=new Set<string>();
 private lockedStart:number|null=null;
 private pending:{start:number;end:number;text:string}|null=null;
 private relocating=false;

 begin(id:string){
  if(this.retired.has(id))return false;
  if(id!==this.id){if(this.id)this.retired.add(this.id);this.id=id;this.anchor=this.position;this.lockedStart=null;this.pending=null;}
  return true;
 }
 select(script:string,text:string,final:boolean,stableText=''):Candidate|null{
  const found=findCandidate(script,text,this.anchor)??findShortPreview(script,text,this.anchor);
  if(this.allows(script,found)&&found?.exact){this.pending=null;return found;}
  const target=findExactReadingTail(script,text,this.anchor);
  if(!target){this.pending=null;if(this.allows(script,found)&&found&&found.similarity>=.6)return found;const nearby=findSemanticCandidate(script,text,this.anchor);return this.allows(script,nearby)?nearby:null;}
  if(this.allows(script,target)){this.pending=null;return target;}
  const spoken=normalized(text).text;
  const stable=normalized(stableText).text.length>=6?findExactReadingTail(script,stableText,this.anchor):null;
  const stableSupport=!!stable&&stable.start>=target.start&&stable.end<=target.end;
  const growing=!!this.pending&&target.start===this.pending.start&&target.end>=this.pending.end+2&&spoken.startsWith(this.pending.text);
  this.pending={start:target.start,end:target.end,text:spoken};
  if(!final&&!stableSupport&&!growing)return null;
  this.anchor=target.start;this.lockedStart=target.start;this.relocating=true;this.pending=null;
  return target;
 }
 allows(script:string,candidate:Candidate|null){
  if(!candidate)return false;
  const count=(a:number,b:number)=>normalized(script.slice(Math.min(a,b),Math.max(a,b))).text.length;
  // A short common phrase in a later sentence is not a license to skip there.
  if(candidate.start>this.anchor&&count(this.anchor,candidate.start)>2)return false;
  // Small overlap between ASR segments is useful; returning to a previous
  // sentence is not. A cumulative revision uses the same segment anchor.
  if(candidate.start<this.anchor&&count(candidate.start,this.anchor)>6)return false;
  if(this.lockedStart!==null&&count(this.lockedStart,candidate.start)>1)return false;
  return true;
 }
 preview(script:string,candidate:Candidate|null,semanticAccepted=false){
  if(!this.allows(script,candidate)||!candidate)return false;
  // Unstable fuzzy fragments must not move the visible cursor speculatively.
  if(!candidate.exact&&!semanticAccepted)return false;
  this.lockedStart??=candidate.start;
  if(this.relocating){this.position=candidate.end;this.confirmed=candidate.start;this.relocating=false;}
  else this.position=Math.max(this.position,candidate.end);
  return true;
 }
 confirm(script:string,candidate:Candidate|null,semanticAccepted=false){
  if(!this.preview(script,candidate,semanticAccepted)||!candidate)return false;
  this.confirmed=Math.max(this.confirmed,candidate.end);
  return true;
 }
 reset(){this.position=0;this.confirmed=0;this.anchor=0;this.id='';this.retired.clear();this.lockedStart=null;this.pending=null;this.relocating=false;}
}
