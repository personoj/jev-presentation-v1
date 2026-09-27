import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {evaluate} from '../shared/api';
import type {Evaluation,FeatureProps,Question} from '../shared/types';
import {JevMark} from './Geometry';

type Kind='choice'|'noul'|'score';
const departments=['宿舍报修','教务咨询','校园卡服务'];
const keys=['repair','academic','card'];
const messages=['宿舍空调坏了，能安排人来修吗？','我的校园卡丢了，应该去哪里补办？','这学期的选课什么时候结束？'];
const notices=[{title:'周五 · 城市与生活',before:'本周五晚七点，在报告厅举行讲座。',focus:'无法到场的同学可以通过直播观看。',value:.96},{title:'周六 · 阅读分享会',before:'本周六下午三点，在图书馆举行分享会。',focus:'请提前十分钟到场，活动结束后可以交流。',value:.12}];
const requests=['想问一下，阅览室周末几点开门？','宿舍的空调开不了，今晚没法正常使用。','水管一直在漏水，地上的积水还在增加。'];
const demoScores=[.2,1.1,1.9];
const questionByKind:Record<Kind,Question>={
 choice:{type:'choice',instructions:'把这条校园消息交给最合适的一个服务部门。仅选择所列选项。',criteria:{repair:'宿舍维修、设备故障与报修',academic:'课程、选课、考试等教务咨询',card:'校园卡丢失、补办、充值与卡片服务'}},
 noul:{type:'noul',instructions:'这则通知是否明确说明支持线上参加、直播观看或远程参与？只根据通知的明确表达，不能从未提到线上参与推断活动绝对没有直播。'},
 score:{type:'score',instructions:'依据消息表达的影响与时间紧迫程度，按给定等级评价校园服务求助的紧急程度。只使用消息中的信息。',criteria:['普通信息咨询，不影响当前使用','影响正常使用，需要安排处理','损失正在持续，需要优先处理']}
};

function useNumber(value:number){const [shown,setShown]=useState(0);const current=useRef(0);useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){current.current=value;setShown(value);return}const start=performance.now(),from=current.current;let raf=0;function frame(now:number){const t=Math.min(1,(now-start)/900);current.current=from+(value-from)*(1-(1-t)**3);setShown(current.current);if(t<1)raf=requestAnimationFrame(frame)}raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf)},[value]);return shown}
function AnimatedNumber({value,digits=0}:{value:number;digits?:number}){return <>{useNumber(value).toFixed(digits)}</>}

export function Example({kind,beat,setBeat,onRecord,onQuota}:FeatureProps&{kind:Kind;beat:number;setBeat:(beat:number)=>void}){
 const [variant,setVariant]=useState(0),[result,setResult]=useState<Evaluation|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef<AbortController|null>(null),version=useRef(0);
 useEffect(()=>()=>{version.current++;pending.current?.abort()},[]);
 function change(next:number){version.current++;pending.current?.abort();setVariant(next);setResult(null);setError('');setBusy(false);setBeat(0)}
 async function run(){pending.current?.abort();const control=new AbortController();pending.current=control;const stamp=++version.current;setBusy(true);setError('');setResult(null);
  const state=kind==='choice'?messages[variant]:kind==='noul'?`${notices[variant].before}${notices[variant].focus}`:{messages:requests};
  const questions=kind==='score'?Object.fromEntries(requests.map((_,i)=>[`q${i}`,{...questionByKind.score,instructions:`${questionByKind.score.instructions} 本题只评价 messages[${i}]。`}])):{answer:questionByKind[kind]};
  try {const out=await evaluate(state,questions,{signal:control.signal,stateVersion:stamp});if(control.signal.aborted||stamp!==version.current)return;
   const a=out.answers.answer;
   if(kind==='choice'&&!keys.includes(a?.choice??''))throw new Error('返回的选项不在这次问题的范围内，请重试。');
   if(kind==='noul'&&!(typeof a?.noul==='number'&&a.noul>=0&&a.noul<=1))throw new Error('这次没有得到有效概率，请重试。');
   if(kind==='score'&&!requests.every((_,i)=>{const score=out.answers[`q${i}`]?.score;return typeof score==='number'&&score>=0&&score<=2}))throw new Error('这次没有得到完整的评分，请重试。');
   setResult(out);setBeat(2);onRecord?.({id:out.requestId,label:`${kind} 校园应用`,at:new Date().toISOString(),input:{state,questions},output:out,source:'live'});
  }catch(e){if(control.signal.aborted||stamp!==version.current)return;setError(e instanceof TypeError?'暂时连不上模型服务。可以重试，或回到示意继续讲解。':e instanceof SyntaxError?'服务没有返回有效结果，请重试。':(e as Error).message);if((e as {code?:string}).code==='QUOTA_EXCEEDED')onQuota?.((e as Error).message)}finally{if(stamp===version.current)setBusy(false)}
 }
 const show=beat>=1&&!busy&&!error;
 const choice=kind==='choice'&&result?keys.indexOf(result.answers.answer.choice!):[0,2,1][variant];
 const probability=kind==='noul'&&result?result.answers.answer.noul!:notices[Math.min(variant,1)].value;
 const scores=kind==='score'&&result?requests.map((_,i)=>result.answers[`q${i}`].score!):demoScores;
 return <div className={`example-scene example-${kind} beat-${beat} ${show?'show-result':''} ${busy?'is-busy':''}`}>
  <div className="example-toolbar"><div className="example-tabs" role="group" aria-label="选择例子">{kind==='choice'?['设备故障','校园卡丢失','选课咨询'].map((name,i)=><button key={name} aria-pressed={variant===i} onClick={()=>change(i)}>{name}</button>):kind==='noul'?['通知 A · 提供直播','通知 B · 未提及线上'].map((name,i)=><button key={name} aria-pressed={variant===i} onClick={()=>change(i)}>{name}</button>):<span className="score-legend"><i/> 0 普通咨询 <i/> 1 影响使用 <i/> 2 持续损失</span>}</div><span className={`result-provenance ${result?'live':''}`} role="status">{busy?'正在请求 Jev…':error?'本次请求未完成':result?'● Jev 实际返回':'示意演示'}</span></div>
  {kind==='choice'?<div className="routing-scene"><div className="routing-message"><span className="small-label">学生留言</span><p key={variant}>{messages[variant]}</p><span className="message-signature">校园服务中心</span></div><div className="routing-map"><svg viewBox="0 0 700 320" preserveAspectRatio="none" fill="none" aria-hidden="true">{[60,160,260].map((y,i)=><g key={i}><path className="route-track" d={`M0 160H180C300 160 280 ${y} 400 ${y}H500`}/><path className={`route-active ${show&&choice===i?'on':''}`} pathLength="1" d={`M0 160H180C300 160 280 ${y} 400 ${y}H500`}/>{show&&choice===i&&<g className="message-packet" key={`${variant}-${beat}-${result?.requestId??"demo"}`}><rect x="-19" y="-13" width="38" height="26" rx="4" fill="var(--blue)"/><path d="M-12 -5H12M-12 1H7M-12 7H3" stroke="white" strokeWidth="1.5"/><animateMotion dur="1.35s" fill="freeze" path={`M0 160H180C300 160 280 ${y} 400 ${y}H500`}/></g>}</g>)}</svg><div className="routing-model"><JevMark/><span>Choice</span></div><div className="recipients">{departments.map((name,i)=><div key={name} className={`recipient ${show&&choice===i?'chosen':''}`}><span>0{i+1}</span><strong>{name}</strong><b>{show&&choice===i?'✓':'↗'}</b></div>)}</div></div><div aria-hidden={!(show&&beat>=2)} className={`routing-arrival ${show&&beat>=2?'on':''}`}><span>消息已进入</span><strong>{departments[choice]}</strong><span>处理队列</span><small>流程示意</small></div></div>:kind==='noul'?<div className="noul-scene"><article className="notice-card"><span className="notice-pin"/><span className="small-label">活动通知</span><h2>{notices[variant].title}</h2><p>{notices[variant].before}</p><p className={`notice-focus ${beat>=1?'on':''}`}>{notices[variant].focus}</p><span className="notice-sign">校园活动中心</span></article><div className="noul-instrument"><div className="small-label">通知是否明确支持线上参加？</div><div className="probability-readout">{show?<><AnimatedNumber value={probability*100}/><span>%</span></>:<span className="awaiting-number">?</span>}</div><div className="probability-ruler"><div className="ruler-ticks">{Array.from({length:21},(_,i)=><i key={i}/>)}</div><div className="ruler-fill" style={{width:show?`${probability*100}%`:'0%'}}/><div className="ruler-pointer" style={{left:show?`${probability*100}%`:'0%'}}/></div><div className="ruler-labels"><span>0 · 否</span><span>1 · 是</span></div><div aria-hidden={!(show&&beat>=2)} className={`noul-tag ${show&&beat>=2?'on':''}`}>{probability>=.8?'◉ 标注为：支持线上参加':probability<=.2?'○ 标注为：未明确支持线上参加':'◌ 信息待核实'}</div></div></div>:<div className="score-scene"><div className="score-axis-label"><span>求助消息</span><span>紧急程度</span><span>{beat>=2?'处理顺序':'按同一套标准判断'}</span></div><div className="score-rows">{requests.map((text,i)=>{const order=[0,1,2].sort((a,b)=>scores[b]-scores[a]||a-b);const rank=order.indexOf(i);return <div className={`score-row score-tone-${i}`} key={text} style={{'--row':show&&beat>=2?rank:i} as CSSProperties}><div className="request-copy"><span>0{i+1}</span><p>{text}</p></div><div className="score-track"><div className="score-track-line"><i style={{width:show?`${scores[i]/2*100}%`:'0%'}}/><b style={{left:show?`${scores[i]/2*100}%`:'0%'}}/></div><div className="score-track-ticks"><span>0</span><span>1</span><span>2</span></div></div><strong className="score-value">{show?<AnimatedNumber value={scores[i]} digits={1}/>: '—'}</strong><span aria-hidden={!(show&&beat>=2)} className={`queue-rank ${show&&beat>=2?'on':''}`}>第 {rank+1} 位</span></div>})}</div></div>}
  <div className="example-action"><span>{error?<span className="example-error" role="alert">{error}</span>:busy?'等待真实结果，完成后更新画面。':result?`本次真实调用 · ${result.elapsedMs} ms`:kind==='choice'?'先定义去向，再让模型选择。':kind==='noul'?'没有写明，不等于确认没有。': '分数的含义，来自我们事先定义的等级。'}</span><div>{(result||error)&&<button className="deck-secondary" onClick={()=>change(variant)}>回到示意</button>}<button className="deck-primary" disabled={busy} onClick={()=>void run()}>{busy?'正在判断…':error?'重试判断':'用 Jev 判断'} <span>↗</span></button></div></div>
 </div>
}
