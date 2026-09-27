import {useEffect,useRef,type CSSProperties} from 'react';
import {comparisonEvidence as data,comparisonFrame,clamp,ease,timeline} from './comparison-motion';
import {useComparisonMotion} from './use-comparison-motion';
import './comparison-overlay.css';

const reveal=(progress:number,dy=12):CSSProperties=>({opacity:progress,transform:`translateY(${(1-progress)*dy}px)`});

function TimeAxis({seconds,color,pulse}:{seconds:number;color:string;pulse:number}){
 const end=492*seconds/timeline.axisSeconds;
 return <svg className="comparison-axis" viewBox="-12 -14 516 62" aria-hidden="true">
  <path d="M0 0H492" stroke="#aaa49b" strokeWidth="2"/>
  <path d={`M0 0H${end}`} stroke={color} strokeWidth="10"/>
  <circle r="4" fill="#172329"/><circle cx="492" r="4" fill="#172329"/>
  {seconds>0&&<><circle cx={end} r={7+16*pulse} fill={color} opacity={.16*pulse}/><circle cx={end} r="7" fill={color}/></>}
  <g fill="#19282b" fontSize="23" fontFamily="Times New Roman,serif"><text x="0" y="35" textAnchor="middle">0</text><text x="246" y="35" textAnchor="middle">{seconds.toFixed(3)} / 9 s</text><text x="492" y="35" textAnchor="middle">9 s</text></g>
 </svg>;
}

export function ComparisonOverlay({open,onClose,onNext}:{open:boolean;onClose:()=>void;onNext:()=>void}){
 const {presence,time,driver}=useComparisonMotion(open),p=ease(presence),frame=comparisonFrame(time);
 const dialog=useRef<HTMLElement>(null),wasOpen=useRef(false),visible=presence>0;
 useEffect(()=>{
  if(open&&visible&&!wasOpen.current){dialog.current?.focus({preventScroll:true});wasOpen.current=true;}
  else if(!open&&wasOpen.current){document.querySelector<HTMLButtonElement>('.r-footer button:last-child')?.focus({preventScroll:true});wasOpen.current=false;}
 },[open,visible]);
 return <div className="comparison-overlay" data-open={open} data-presence={presence.toFixed(4)} data-motion-time={time.toFixed(1)} aria-hidden={!open} inert={!open} style={{visibility:presence>0?'visible':'hidden'}}>
  <span className="comparison-clock" ref={driver}/>
  <div className="comparison-backdrop" style={{opacity:p,backdropFilter:`blur(${5*p}px)`}}/>
  <section ref={dialog} role="dialog" aria-modal={open||undefined} aria-labelledby="comparison-overlay-title" tabIndex={-1} className="comparison-sheet" style={{opacity:ease(presence*4),transform:`translate(${(1-p)*390}px,${(1-p)*105}px) scale(${.72+.28*p}) rotate(${(1-p)*-1.4}deg)`}}>
   <div className="comparison-paper-fallback"/>
   <img className="comparison-paper" src="/reference-art/comparison-paper.png" alt="" draggable={false} onError={e=>{e.currentTarget.style.display='none'}}/>
   <h2 id="comparison-overlay-title">同一个判断任务，差多少？</h2>
   <span className="comparison-source-label">官方演示对照</span>
   <button className="comparison-close" aria-label="关闭对比，返回第四页" onClick={onClose}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 5L27 27M27 5L5 27"/></svg></button>
   <div className="comparison-top-rule"/>
   <div className="comparison-input" style={reveal(frame.input,18)}>同一份输入 · 同一组判断问题</div>
   <svg className="comparison-branches" viewBox="0 0 1672 941" aria-hidden="true" style={{opacity:frame.branches}}>
    {['M836 280C836 314 811 317 791 317H667','M836 280C836 314 861 317 881 317H1005'].map((d,i)=><path key={d} d={d} pathLength="1" stroke={i?'#a33a20':'#29475e'} strokeWidth="1.5" strokeDasharray="1" strokeDashoffset={1-frame.branches} fill="none"/>)}
    <path d="M674 312L667 317L674 322M998 312L1005 317L998 322" stroke="#5f625d" strokeWidth="1.2" fill="none"/>
   </svg>
   <div className="comparison-center-rule" style={{opacity:frame.models}}/>
   {[{key:'llm',name:data.llm.name,description:'默认推理',seconds:frame.llmSeconds,cost:data.llm.cost,color:'#163e52'},
     {key:'jev',name:data.jev.name,description:'结构化判断',seconds:frame.jevSeconds,cost:data.jev.cost,color:'#a33a20'}].map(model=><div key={model.key} className={`comparison-model comparison-${model.key}`} style={{'--model-ink':model.color} as CSSProperties}>
    <div className="comparison-model-heading" style={reveal(frame.models)}><h3>{model.name}</h3><p>{model.description}</p></div>
    <div className="comparison-timing" style={reveal(frame.timerReveal)}>
     <p className="comparison-metric-label">完成时间</p>
     <div className="comparison-time" aria-label={`${model.name} 完成时间 ${data[model.key as 'llm'|'jev'].seconds} 秒`}><span aria-hidden="true">{model.seconds.toFixed(3)}</span><span className="comparison-unit" aria-hidden="true"> s</span></div>
     <TimeAxis seconds={model.seconds} color={model.color} pulse={Math.sin(Math.PI*clamp((time-timeline.timer[0]-(data[model.key as 'llm'|'jev'].seconds/data.llm.seconds)*(timeline.timer[1]-timeline.timer[0]))/420))}/>
    </div>
    <div className="comparison-cost" style={reveal(frame.cost,20)}><p className="comparison-metric-label">本次调用费用</p><div className="comparison-money">${model.cost.toFixed(6)}</div><i style={{transform:`scaleX(${frame.cost})`}}/></div>
   </div>)}
   <p className="comparison-scale-note" style={{opacity:frame.timerReveal}}>{frame.timing?'计时动画等比例加速 · 非现场请求':'时间条采用相同刻度'}</p>
   <div className="comparison-conclusion" style={{...reveal(frame.conclusion,24),transform:`translateY(${(1-frame.conclusion)*24}px) scale(${.97+.03*frame.conclusion})`}}><span>本次演示：Jev 耗时约为</span><strong>1/{frame.timeRatio}</strong><span>，费用约为</span><strong>1/{frame.costRatio}</strong></div>
   <p className="comparison-price" style={reveal(frame.footer,6)}>Jev 公布单价：<span>${data.inputPricePerMillion}</span> / 百万输入 token，输出免费</p>
   <div className="comparison-bottom-rule"/>
   <a className="comparison-source" href={data.sources.demo} target="_blank" rel="noreferrer">来源：TypeSafe 官网演示 · {data.date} ↗</a>
   <p className="comparison-conditions">短输入任务，LLM 默认推理；实际表现随任务与网络变化。</p>
   <button className="comparison-continue" onClick={onNext}>继续：训练目标 <span>→</span></button>
  </section>
 </div>;
}
