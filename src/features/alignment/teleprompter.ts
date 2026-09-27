import {findCandidate,findExactReadingTail,findShortPreview,findUniqueShortPhrase,findSemanticCandidate,normalized,type Candidate} from './engine';

export type TrackingUpdate={id:string;revision:number;text:string;final:boolean;candidate:Candidate|null;relocation:boolean;strong:boolean};

/** ASR -> local text alignment. No model inputs, choices or probabilities. */
export class Teleprompter {
 position=0;confirmed=0;anchor=0;
 private id='';private previous='';private revision=0;private retired=new Set<string>();private mutedPrefix='';
 reset(){this.position=0;this.confirmed=0;this.anchor=0;this.id='';this.previous='';this.retired.clear();this.mutedPrefix='';this.revision++;}
 seek(position:number){this.position=position;this.confirmed=position;this.anchor=position;this.mutedPrefix=normalized(this.previous).text;this.revision++;}
 propose(script:string,raw:string,final:boolean,id:string):TrackingUpdate|null{
  if(this.retired.has(id))return null;
  if(id!==this.id){if(this.id)this.retired.add(this.id);this.id=id;this.previous='';this.anchor=this.position;this.mutedPrefix='';}
  const previous=this.previous;this.previous=raw;let text=raw;
  if(this.mutedPrefix){const n=normalized(raw);text=n.text.startsWith(this.mutedPrefix)?raw.slice(n.positions[this.mutedPrefix.length]??raw.length):'';}
  const query=normalized(text).text,old=normalized(previous).text;
  const nearby=(c:Candidate|null)=>!!c&&normalized(script.slice(Math.min(c.start,this.anchor),Math.max(c.start,this.anchor))).text.length<=(c.start>this.anchor?2:6);
  const local=findCandidate(script,text,this.anchor)??findShortPreview(script,text,this.anchor);
  const short=findUniqueShortPhrase(script,text,this.mutedPrefix?'':previous,this.anchor);
  let candidate:Candidate|null=null,relocation=false;
  if(short&&short.end<this.position){candidate=short;relocation=true;}
  else if(local?.exact&&nearby(local))candidate=local;
  else if(short){candidate=short;relocation=!nearby(short);}
  else {
   const tail=findExactReadingTail(script,text,this.anchor);
   if(tail){candidate=tail;relocation=!nearby(tail)||tail.end<this.position;}
   else if(local&&nearby(local)&&local.similarity>=.6)candidate=local;
   else candidate=findSemanticCandidate(script,text,this.anchor);
  }
  // A revised, shorter prefix is not a new act of rereading.
  if(query.length<old.length&&old.startsWith(query)&&!this.mutedPrefix)relocation=false;
  return {id,revision:++this.revision,text,final,candidate,relocation,strong:!!candidate&&!candidate.semantic&&candidate.similarity>=.88};
 }
 commit(update:TrackingUpdate){
  if(update.revision!==this.revision||update.id!==this.id||!update.candidate)return false;
  const c=update.candidate;
  if(update.relocation){this.position=c.end;this.confirmed=update.final?c.end:c.start;this.anchor=c.start;}
  else {this.position=Math.max(this.position,c.end);if(update.final)this.confirmed=Math.max(this.confirmed,c.end);}
  return true;
 }
}

/** Jev controls only the play/pause gate. It cannot supply a text position. */
export class FollowGate {
 state:'unknown'|'following'|'paused'='unknown';
 probability:number|null=null;
 private history:{id:string;text:string}[]=[];
 observe(update:TrackingUpdate){if(update.final){this.history=[...this.history.filter(h=>h.id!==update.id),{id:update.id,text:update.text}].slice(-4)}}
 context(update:TrackingUpdate){return this.history.filter(h=>h.id!==update.id).map(h=>h.text)}
 decide(probability:number){this.probability=probability;if(probability>=.65)this.state='following';else if(probability<=.35)this.state='paused';}
 mayTrack(update:TrackingUpdate,fresh=false){
  if(this.state==='paused'||!update.candidate)return false;
  if(this.state==='following')return fresh||update.strong;
  // Before the first yes/no result, preview only a strong local continuation.
  return update.strong&&!update.relocation;
 }
 unavailable(){this.state='paused';this.probability=null;}
 reset(){this.state='unknown';this.probability=null;this.history=[];}
}
