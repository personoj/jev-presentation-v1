import timeline from '../../production/primitives-motion/build/timeline.json';
export {timeline};
export type PrimitiveKind='choice'|'noul'|'score';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const smooth=(n:number)=>{const p=clamp(n);return p*p*p*(p*(p*6-15)+10)};
export const progress=(t:number,[a,b]:number[])=>smooth((t-a)/(b-a));
export const SCORE_STOPS=[{x:1230,y:617,top:637},{x:1360,y:571,top:591},{x:1494,y:517,top:537}] as const;

export function noulPose(time:number){
 const frames=timeline.noul.keyframes;
 let value=frames[frames.length-1][1];
 for(let i=1;i<frames.length;i++){
  if(time<=frames[i][0]){const [a,p]=frames[i-1],[b,q]=frames[i];value=p+(q-p)*smooth((time-a)/(b-a));break;}
 }
 return {x:621+428*value,y:591,value};
}

export function choicePose(time:number){
 const selected=progress(time,timeline.choice.select);
 return {
  draw:timeline.choice.draw.map(range=>progress(time,range)),
  scan:timeline.choice.scan.map(([a,b])=>Math.sin(Math.PI*clamp((time-a)/(b-a)))),
  selected,
  packetX:127+270*selected,
  packetVisible:selected>0&&selected<1,
  settled:time>=timeline.choice.select[1],
 };
}

export function scorePose(time:number){
 let stop=0;
 for(const [start,end,from,to] of timeline.score.hops){
  if(time<start)break;
  if(time>=end){stop=to;continue;}
  const u=clamp((time-start)/(end-start)),p=smooth(u),a=SCORE_STOPS[from],b=SCORE_STOPS[to];
  const x=a.x+(b.x-a.x)*p,y=a.y+(b.y-a.y)*p-timeline.score.arcHeight*Math.sin(Math.PI*u);
  const direction=Math.sign(b.x-a.x),sx=x+direction*Math.min(26,Math.abs(b.x-x)*.25),sy=y-24+18*Math.sin(Math.PI*u),ex=b.x,ey=b.y-24;
  return {x,y,from,to,direction,moving:true,arrow:`M${sx} ${sy}Q${(sx+ex)/2} ${Math.min(sy,ey)-18} ${ex} ${ey}`,arrowOpacity:Math.sin(Math.PI*u)*.9};
 }
 const at=SCORE_STOPS[stop];
 return {x:at.x,y:at.y,from:stop,to:stop,direction:0,moving:false,arrow:'M0 0',arrowOpacity:0};
}
