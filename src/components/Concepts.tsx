import {ResidentSprite} from '../features/abm/ResidentSprite';
import {useEffect,useRef,useState} from 'react';
import {evaluate} from '../shared/api';
import type {Answer,Evaluation,FeatureProps,Question} from '../shared/types';
import './concepts.css';

const questions:Record<string,Question>={
 stance:{type:'choice',instructions:'这段意见对文化消费券政策的总体立场是什么？',criteria:{support:'总体支持政策',oppose:'总体反对政策',mixed:'明确同时表达支持和反对',unspecified:'未表达立场'}},
 distance:{type:'noul',instructions:'这段意见是否明确表达了出行距离方面的顾虑？'},
 intention:{type:'score',instructions:'这段意见表达的近期参与意愿是什么程度？',criteria:['明确不打算近期参与','尚未决定或等待条件','已有明确近期参与计划']}
};
const primitiveTabs=[
 {name:'Choice',label:'在候选项中选择',question:'对政策的总体立场是什么？',key:'stance',desc:'支持、反对、混合、未表达，各自对应一个明确选项。',example:'支持 / 反对 / 混合 / 未表达'},
 {name:'Noul',label:'判断一个条件',question:'是否明确表达了距离顾虑？',key:'distance',desc:'返回这个判断为“是”的概率，取值在 0 到 1 之间。',example:'P（表达了距离顾虑）'},
 {name:'Score',label:'在有序等级上评分',question:'近期参与意愿有多强？',key:'intention',desc:'0 不打算参与，1 尚未决定，2 已有计划。分数由等级概率加权得到。',example:'0 不参与 → 1 未决定 → 2 有计划'}
];
const labels:Record<string,string>={support:'支持',oppose:'反对',mixed:'混合',unspecified:'未表达','0':'不参与','1':'未决定','2':'有计划'};
function PrimitiveGlyph({type}:{type:number}){
 return <svg viewBox="0 0 176 82" aria-hidden="true" className="cpt-glyph">
  {type===0?<><path className="cpt-glyph-shadow" d="M17 45H61C86 45 83 17 113 17H150M61 45H150M61 45C86 45 83 73 113 73H150"/><path d="M17 41H61C86 41 83 13 113 13H150M61 41H150M61 41C86 41 83 69 113 69H150"/><path d="m143 6 8 7-8 7m0 14 8 7-8 7m0 14 8 7-8 7"/><circle cx="18" cy="41" r="5" className="cpt-glyph-dot"/><circle cx="113" cy="13" r="5" className="cpt-glyph-dot"/></>
   :type===1?<><path className="cpt-glyph-shadow" d="M17 45H157"/><path d="M17 41H157"/><path d="M45 28V54M131 28V54"/><circle cx="110" cy="41" r="15" className="cpt-glyph-dial"/><circle cx="110" cy="41" r="4" className="cpt-glyph-dot"/><text x="40" y="76">0</text><text x="127" y="76">1</text></>
   :<><path className="cpt-glyph-fill" d="M22 70V52H65V32H110V12H154V70Z"/><path d="M22 52H65V32H110V12H154M22 70H154"/><path className="cpt-glyph-faint" d="M65 52V70M110 32V70"/><text x="38" y="44">0</text><text x="83" y="24">1</text><text x="128" y="7">2</text></>}
 </svg>
}
function ProbabilityResult({answer,kind}:{answer:Answer;kind:number}){
 const probabilities=answer.probabilities?Object.entries(answer.probabilities):[];
 const value=answer.choice?labels[answer.choice]??answer.choice:answer.noul!==undefined?`${(answer.noul*100).toFixed(1)}%`:answer.score?.toFixed(2)??'—';
 return <div className="cpt-result" aria-live="polite"><div className="cpt-result-heading"><span>{kind===0?'模型选择':kind===1?'“是”的概率':'概率加权分数'}</span><strong>{value}</strong>{kind===2&&<small>/ 2</small>}</div>
  {kind===1&&answer.noul!==undefined?<div className="cpt-noul-result"><div><i style={{width:`${Math.max(0,Math.min(1,answer.noul))*100}%`}}/></div><p><span>0 · 否</span><span>是 · 1</span></p></div>:probabilities.length>0&&<div className="cpt-probabilities">{probabilities.map(([key,val])=><div key={key}><span>{labels[key]??answer.legend?.[key]??key}</span><div><i style={{width:`${Math.max(0,Math.min(1,val))*100}%`}}/></div><b>{(val*100).toFixed(1)}%</b></div>)}</div>}
  {answer.confidence!==undefined&&<p className="cpt-result-note">confidence {answer.confidence.toFixed(2)} · 概括这次分布的集中程度，不能直接当作准确率。</p>}</div>
}
export function Primitives({onRecord,onQuota}:FeatureProps){
 const [text,setText]=useState('文化消费券这个办法我支持，但合作书店离家太远。即使领到券，这周我也不打算去买书。');
 const [result,setResult]=useState<Evaluation|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(0);
 const request=useRef<AbortController|null>(null),version=useRef(0);
 useEffect(()=>()=>{version.current++;request.current?.abort()},[]);
 function changeText(value:string){version.current++;request.current?.abort();setBusy(false);setError('');setResult(null);setText(value)}
 async function run(){request.current?.abort();const controller=new AbortController();request.current=controller;const current=++version.current;setBusy(true);setError('');try{const out=await evaluate(text,questions,{signal:controller.signal,stateVersion:current});if(controller.signal.aborted||current!==version.current)return;setResult(out);onRecord?.({id:out.requestId,label:'三类原语',at:new Date().toISOString(),input:{text,questions},output:out,source:'live'})}catch(e){if(controller.signal.aborted||current!==version.current)return;const err=e as Error&{code?:string};setError(err.message);if(err.code==='QUOTA_EXCEEDED')onQuota?.(err.message)}finally{if(current===version.current)setBusy(false)}}
 const tab=primitiveTabs[selected],answer=result?.answers[tab.key];
 return <div className="cpt-primitives"><div className="cpt-input-sheet"><label htmlFor="primitive-input" className="cpt-kicker">同一段意见 <span>原创样例，可修改</span></label><textarea id="primitive-input" value={text} onChange={e=>changeText(e.target.value)}/><div className="cpt-ask-row"><button className="primary" disabled={busy||!text.trim()} onClick={run}>{busy?'正在判断…':'向 Jev 提问'} <span>↗</span></button><span>{result?`${result.model} · ${result.elapsedMs} ms`:'一次真实调用，分别回答三个问题'}</span></div>{error&&<p className="error" role="alert">{error}</p>}
  <div className="cpt-question-result" role="tabpanel" id={`primitive-panel-${selected}`} aria-labelledby={`primitive-tab-${selected}`}><p className="cpt-question-label">{tab.name} <span>当前问题</span></p><h3>{tab.question}</h3><p className="cpt-question-description">{tab.desc}</p>{answer?<ProbabilityResult answer={answer} kind={selected}/>:<div className="cpt-answer-placeholder"><span>等待真实结果</span><p>点击右侧图解切换问题；提问后，可以逐项检查答案和概率。</p></div>}</div></div>
  <div className="cpt-primitive-map"><div className="cpt-map-heading"><span>把问题写清楚</span><span>返回可使用的值</span></div><div className="cpt-primitive-options" role="tablist" aria-label="原语类型" aria-orientation="vertical">{primitiveTabs.map((item,index)=><button type="button" className={`cpt-primitive-option ${index===selected?'is-selected':''}`} role="tab" tabIndex={selected===index?0:-1} id={`primitive-tab-${index}`} aria-controls={`primitive-panel-${index}`} aria-selected={selected===index} key={item.name} onClick={()=>setSelected(index)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=(index+(event.key==='ArrowDown'?1:2))%3;setSelected(next);document.getElementById(`primitive-tab-${next}`)?.focus()}}}><div className="cpt-primitive-label"><span className="cpt-primitive-number">0{index+1}</span><strong>{item.name}</strong><span>{item.label}</span></div><PrimitiveGlyph type={index}/><span className="cpt-primitive-example">{item.example}</span><span className="cpt-primitive-arrow" aria-hidden="true">↗</span></button>)}</div><p className="cpt-map-footnote">立场、顾虑和行动意愿分别提问，避免压缩成一个含义不明的总分。</p></div>
 </div>
}

const uncertaintyExamples=[
 {id:'A',title:'更倾向“还在考虑”',probabilities:[.1,.8,.1],caption:'大部分概率落在中间等级。',action:'可以继续询问：时间、距离等条件是否合适？',tone:'center'},
 {id:'B',title:'“不去”与“会去”都可能',probabilities:[.45,.1,.45],caption:'概率落在两端，平均值掩盖了分歧。',action:'先补充上下文，再决定是否触发后续动作。',tone:'split'}
];
export function Uncertainty(){const [full,setFull]=useState(true);return <div className={`cpt-uncertainty ${full?'is-full':'is-mean-only'}`}>
 <div className="cpt-uncertainty-toolbar"><div><span className="cpt-kicker">问题：这位居民近期会使用消费券吗？</span><p>同一套等级定义，比较两种假设的模型输出。</p></div><div className="cpt-view-switch" role="group" aria-label="分布显示方式"><button aria-pressed={full} onClick={()=>setFull(true)}>完整分布</button><button aria-pressed={!full} onClick={()=>setFull(false)}>只看均值</button></div></div>
 <div className="cpt-distribution-grid">{uncertaintyExamples.map(example=><section className={`cpt-distribution cpt-distribution-${example.tone}`} key={example.id} aria-label={`示例 ${example.id}`}><header><div><span className="cpt-example-id">假设输出 {example.id}</span><h3>{full?example.title:'平均分相同'}</h3></div><div className="cpt-mean"><span>Score</span><strong>1.00</strong></div></header>
  <div className="cpt-probability-plot" role="img" aria-label={full?`等级 0 不去、1 考虑、2 会去的概率分别为 ${example.probabilities.map(p=>`${p*100}%`).join('、')}，均值为 1`:'只显示均值 1，分布已隐藏'}><div className="cpt-plot-grid" aria-hidden="true"><span>100%</span><i/><span>50%</span><i/><span>0</span></div><div className="cpt-plot-columns" aria-hidden="true">{example.probabilities.map((probability,index)=><div className="cpt-plot-column" key={index}><div className="cpt-plot-well"><div className="cpt-plot-fill" style={{height:`${probability*100}%`}}><strong>{probability*100}<small>%</small></strong></div></div><span><b>{index}</b> {['不去','考虑','会去'][index]}</span></div>)}</div>{!full&&<div className="cpt-mean-curtain"><strong>1.00</strong><span>单看这个数字，无法区分 A 和 B。</span></div>}</div>
  <p className="cpt-distribution-caption">{full?example.caption:'概率加权后，两种情况得到同一个分数。'}</p><div className="cpt-distribution-action"><span>处理思路</span><p>{full?example.action:'需要查看完整分布，才能选择后续处理。'}</p></div></section>)}</div>
 <div className="cpt-distribution-footer"><div><span>计算方式</span><p>Score = 0 × P(0) + 1 × P(1) + 2 × P(2)</p></div><p>概率为人为构造的教学示例，表示对单次判断的分配，不是人群比例或预测准确率。</p></div>
 </div>}

const flowSteps=['可见状态','定义问题','示意判断','约束检查','执行记账'];
function WorkflowStage({step,balance,stock,blocked}:{step:number;balance:number;stock:number;blocked:boolean}){
 if(step===0)return <div className="cpt-flow-state"><p className="cpt-stage-heading">这位居民能看到什么？</p><div className="cpt-state-information"><div><span>私有信息</span><strong>想买一本书</strong><p>可支配余额 {balance}，对读书有兴趣。其他居民的余额不在上下文中。</p></div><div><span>公开信息</span><strong>书价 60 · 存货 {stock}</strong><p>附近书店参加活动；消费满 60，可以使用一张 30 元券。</p></div></div><div className="cpt-state-sentence">把与这个决定有关的信息，交给模型。</div></div>;
 if(step===1)return <div className="cpt-flow-question"><p className="cpt-stage-heading">接下来选择哪种行动？</p><p className="cpt-stage-copy">选择范围由程序预先定义，保留“暂不消费”作为可执行选项。</p><div className="cpt-choice-candidates"><div><b>A</b><strong>去书店买书</strong><code>buy_book</code></div><div><b>B</b><strong>去剧场看戏</strong><code>buy_ticket</code></div><div><b>C</b><strong>暂不消费</strong><code>wait</code></div></div><p className="cpt-inline-note">Choice 问题只负责表达行动意向；资金和库存由程序检查。</p></div>;
 if(step===2)return <div className="cpt-flow-judgment"><p className="cpt-stage-heading">假设模型更倾向“去书店买书”</p><div className="cpt-demo-probabilities">{[['去书店买书',.76],['去剧场看戏',.08],['暂不消费',.16]].map(([label,probability])=><div key={label}><span>{label}</span><div><i style={{width:`${Number(probability)*100}%`}}/></div><strong>{Number(probability)*100}%</strong></div>)}</div><div className="cpt-selection-line"><span>示例决策规则</span><strong>选择概率最大的行动 → 买书</strong></div><p className="cpt-inline-note">这些数值为人工设定，用来说明流程；没有调用模型。</p></div>;
 if(step===3)return <div className="cpt-flow-constraints"><p className="cpt-stage-heading">有购买意向，还要满足成交条件</p><div className="cpt-check-list"><div><span>优惠券</span><strong>60 ≥ 60，券未使用</strong><b className="is-pass">通过</b></div><div><span>居民余额</span><strong>{balance} {balance>=30?'≥':'<'} 60 − 30</strong><b className={balance>=30?'is-pass':'is-blocked'}>{balance>=30?'通过':'不足'}</b></div><div><span>书店库存</span><strong>{stock} {stock>0?'≥':'<'} 1</strong><b className={stock>0?'is-pass':'is-blocked'}>{stock>0?'通过':'缺货'}</b></div></div><p className={`cpt-constraint-outcome ${blocked?'is-blocked':'is-pass'}`}>{blocked?'约束未通过 → 不创建交易，余额和库存保持原值。':'条件全部通过 → 可以创建一笔交易。'}</p></div>;
 return <div className={`cpt-flow-ledger ${blocked?'is-blocked':''}`}><p className="cpt-stage-heading">{blocked?'本次不成交，保留判断与阻止原因':'成交一次，同时更新四项状态'}</p>{blocked?<div className="cpt-blocked-ledger"><strong>{balance<30?'余额不足':'书店缺货'}</strong><p>居民余额 {balance}，书店库存 {stock}，财政与商家账户均不发生变化。</p><span>模型的行动意向已记录，未执行付款。</span></div>:<><div className="cpt-ledger-transfer"><div><span>居民支付</span><strong>30</strong></div><b>＋</b><div><span>财政补贴</span><strong>30</strong></div><b>＝</b><div><span>商家收入</span><strong>60</strong></div></div><div className="cpt-ledger-balances"><div><span>居民余额</span><strong>{balance} <i>→</i> {balance-30}</strong></div><div><span>书店库存</span><strong>1 <i>→</i> 0</strong></div><div><span>财政可用额</span><strong>30 <i>→</i> 0</strong></div><div><span>优惠券</span><strong>未使用 <i>→</i> 已核销</strong></div></div></>}<p className="cpt-inline-note">一笔提交统一更新状态；记录判断输入、选项和执行结果，便于回查。</p></div>;
}
export function Workflow(){
 const [step,setStep]=useState(0),[playing,setPlaying]=useState(false),[lowBudget,setLowBudget]=useState(false),[emptyStock,setEmptyStock]=useState(false);
 const balance=lowBudget?20:45,stock=emptyStock?0:1,blocked=lowBudget||emptyStock;
 useEffect(()=>{if(!playing)return;if(step>=4){setPlaying(false);return}const timer=window.setTimeout(()=>setStep(previous=>previous+1),1900);return()=>window.clearTimeout(timer)},[playing,step]);
 function changeCondition(kind:'budget'|'stock'){setPlaying(false);setStep(0);if(kind==='budget')setLowBudget(previous=>!previous);else setEmptyStock(previous=>!previous)}
 function chooseStep(next:number){setPlaying(false);setStep(next)}
 return <div className="cpt-workflow"><div className="cpt-workflow-top"><div><span className="cpt-kicker">一次购书决定</span><span className="cpt-illustration-label">可交互的教学推演 · 所有数值均为示例</span></div><div className="cpt-workflow-controls"><button className="secondary" onClick={()=>{if(playing)setPlaying(false);else{setStep(0);setPlaying(true)}}}>{playing?'暂停推演':'自动推演'}</button><button className="primary" onClick={()=>chooseStep(step===4?0:step+1)}>{step===4?'重新推演':'下一步'} <span>→</span></button></div></div>
  <nav className="cpt-flow-rail" aria-label="购书流程阶段">{flowSteps.map((label,index)=><button className={index===step?'is-current':index<step?'is-complete':''} aria-current={index===step?'step':undefined} key={label} onClick={()=>chooseStep(index)}><span className="cpt-rail-circle">{index<step?'✓':`0${index+1}`}</span><span>{label}</span></button>)}</nav>
  <div className="cpt-workflow-scene"><aside className="cpt-resident-card"><div className="cpt-resident-identity"><div className="cpt-pixel-portrait"><ResidentSprite spriteIndex={0} pose={step===4&&!blocked?'interact':'idle'} label="林澈的像素形象"/></div><div><span>林澈 · 教学样例 R01</span><strong>{step===4?(blocked?'暂缓这次购买':'完成一次购书'):'准备去买书'}</strong></div></div><div className="cpt-purchase-ticket"><div><span>书店标价</span><strong>60</strong></div><div><span>可用消费券</span><strong>− 30</strong></div><div><span>需要自己支付</span><strong>30</strong></div></div><fieldset className="cpt-condition-controls"><legend>改变条件，观察执行结果</legend><label><input type="checkbox" checked={lowBudget} onChange={()=>changeCondition('budget')}/><span>余额只剩 20</span></label><label><input type="checkbox" checked={emptyStock} onChange={()=>changeCondition('stock')}/><span>书店已经售罄</span></label></fieldset></aside><section className="cpt-workflow-stage" aria-live="polite"><div className="cpt-stage-topline"><span>{step===2?'人为构造的模型输出':step===0||step===1?'准备判断':'程序执行规则'}</span><span>0{step+1} / 05</span></div><div className="cpt-stage-content" key={`${step}-${balance}-${stock}`}><WorkflowStage step={step} balance={balance} stock={stock} blocked={blocked}/></div></section></div>
 </div>
}
