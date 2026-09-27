import timeline from '../../production/comparison-overlay/build/timeline.json';

export {timeline};
// These are the paired figures shown in TypeSafe's published demonstration,
// not measurements from this app or the order-routing example underneath it.
export const comparisonEvidence={
 date:'2026.09.28',
 llm:{name:'GPT-5.6 Terra',seconds:8.566,cost:0.013880},
 jev:{name:'Jev',seconds:0.114,cost:0.000081},
 inputPricePerMillion:0.042,
 sources:{demo:'https://typesafe.ai/',article:'https://typesafe.ai/blog/introducing-system-one-models-and-jev',pricing:'https://docs.typesafe.ai/models'},
};
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const ease=(n:number)=>{const p=clamp(n);return p*p*p*(p*(p*6-15)+10)};
export const phase=(time:number,range:number[])=>ease((time-range[0])/(range[1]-range[0]));
export function comparisonFrame(time:number){
 const progress=clamp((time-timeline.timer[0])/(timeline.timer[1]-timeline.timer[0]));
 // One shared simulated clock: never independently ease the two measurements.
 const simulatedSeconds=progress*comparisonEvidence.llm.seconds;
 return {
  llmSeconds:Math.min(simulatedSeconds,comparisonEvidence.llm.seconds),
  jevSeconds:Math.min(simulatedSeconds,comparisonEvidence.jev.seconds),
  input:phase(time,timeline.input),branches:phase(time,timeline.branches),
  models:phase(time,timeline.models),timerReveal:phase(time,timeline.timerReveal),
  cost:phase(time,timeline.cost),conclusion:phase(time,timeline.conclusion),footer:phase(time,timeline.footer),
  timing:time>=timeline.timer[0]&&time<timeline.timer[1],
  timeRatio:Math.round(comparisonEvidence.llm.seconds/comparisonEvidence.jev.seconds),
  costRatio:Math.round(comparisonEvidence.llm.cost/comparisonEvidence.jev.cost),
 };
}
