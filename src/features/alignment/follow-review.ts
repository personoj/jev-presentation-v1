import {normalized} from './engine';
import type {TrackingUpdate} from './teleprompter';

/** A gate verdict belongs to a reading/aside episode, not one ASR revision.
 * Cursor commits still require the tracker's latest revision. */
export class FollowReviewWindow {
 private epoch=0;
 private mode='';
 latest:TrackingUpdate|null=null;
 reset(){this.epoch++;this.mode='';this.latest=null;}
 observe(update:TrackingUpdate,script:string,position:number){
  const c=update.candidate;
  const near=!!c&&c.end>=position&&(c.start<=position||!normalized(script.slice(position,c.start)).text);
  // A long old matching prefix must not mask newly appended aside words.
  const mode=update.strong&&c?.exact?(near?'reading':`relocation:${c.start}`):'uncertain';
  const before=this.latest;
  const text=normalized(update.text).text;
  const extendsPrevious=!!before&&text.startsWith(normalized(before.text).text);
  const changed=!before||before.id!==update.id||mode!==this.mode||!extendsPrevious;
  if(changed)this.epoch++;
  this.latest=update;this.mode=mode;
  return {epoch:this.epoch,changed};
 }
 current(epoch:number){return epoch===this.epoch?this.latest:null;}
}

/** Keep the current speech in the foreground; old asides remain context only. */
export function recentFollowSpeech(text:string){
 const n=normalized(text),cut=n.positions[Math.max(0,n.text.length-24)]??0;
 return {transcript:text.slice(cut),earlierTranscript:text.slice(0,cut).slice(-80)};
}

/** Four new, exact characters at the held reading head can reopen locally.
 * Short incidental words, fuzzy guesses, and distant jumps cannot. */
export function canResumeNearby(update:TrackingUpdate,script:string,position:number){
 const c=update.candidate;
 if(!c?.exact||c.semantic||c.end<=position)return false;
 if(c.start>position&&normalized(script.slice(position,c.start)).text.length)return false;
 const spoken=normalized(update.text).text,match=normalized(c.text).text;
 return match.length>=4&&spoken.endsWith(match)
  &&normalized(script.slice(position,c.end)).text.length>=4;
}
