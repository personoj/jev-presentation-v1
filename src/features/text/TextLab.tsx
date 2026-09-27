import {useEffect, useRef, useState} from 'react';
import {APIError, evaluate} from '../../shared/api';
import type {Answer, Evaluation, FeatureProps} from '../../shared/types';
import './text.css';
import {POLICY, OPINIONS, TEXT_QUESTIONS, stanceLabels} from './questions';

const metrics=[{key:'distance',label:'距离顾虑'},{key:'fairness',label:'公平顾虑'},{key:'original_plan',label:'原有消费计划'}];
const pct=(n:number)=>`${(n*100).toFixed(1)}%`;
function Probability({answer}: {answer?:Answer}) {
  if(answer?.noul===undefined)return <span className="text-empty-value">等待判断</span>;
  return <><span className="text-prob-value">{pct(answer.noul)}</span><span className="text-prob-track"><i style={{width:pct(answer.noul)}}/></span></>;
}
type Saved = {text:string; result:Evaluation};
export function TextLab({onRecord,onQuota}:FeatureProps) {
  const [selected,setSelected]=useState(0),[text,setText]=useState(OPINIONS[0].text),[saved,setSaved]=useState<Record<string,Saved>>({});
  const [result,setResult]=useState<Evaluation|null>(null),[busy,setBusy]=useState(false),[restored,setRestored]=useState(false),[error,setError]=useState('');
  const abort=useRef<AbortController|null>(null),version=useRef(0);
  useEffect(()=>()=>{version.current++;abort.current?.abort();},[]);
  function change(value:string){version.current++;abort.current?.abort();setBusy(false);setText(value);setRestored(false);setResult(null);setError('');}
  function choose(index:number){const opinion=OPINIONS[index];change(opinion.text);setSelected(index);const previous=saved[opinion.id];if(previous?.text===opinion.text){setResult(previous.result);setRestored(true)}}
  async function run(){
    abort.current?.abort();const controller=new AbortController();abort.current=controller;const current=++version.current;const input=text;const id=OPINIONS[selected].id;setBusy(true);setError('');
    try{const output=await evaluate({policy:POLICY,opinion:input,source:'原创虚构文本，只分析文本表达，不推断真实公众态度。'},TEXT_QUESTIONS,{signal:controller.signal,stateVersion:current});
      if(current!==version.current)return;setResult(output);setRestored(false);setSaved(old=>({...old,[id]:{text:input,result:output}}));
      onRecord?.({id:output.requestId,label:`政策意见 ${id} · 文本判断`,at:new Date().toISOString(),input:{policy:POLICY,opinion:input,questions:TEXT_QUESTIONS},output,source:'live'});
    }catch(e){if(controller.signal.aborted||current!==version.current)return;const message=e instanceof Error?e.message:'请求未完成';setError(message);if(e instanceof APIError&&/QUOTA|CREDIT|BALANCE|BUDGET/i.test(e.code))onQuota?.(message);}
    finally{if(current===version.current)setBusy(false);}
  }
  const answers=result?.answers,hasIntention=answers?.intention_present?.noul!==undefined&&answers.intention_present.noul>=0.8;
  return <section className="text-lab" aria-label="政策文本分析实验">
    <div className="text-lab-layout">
      <aside className="text-policy"><span className="text-eyebrow">虚构政策 / CULTURAL VOUCHER</span><h3>文化消费券<br/>试点方案</h3><p>{POLICY}</p><div className="text-policy-stamp">研究情景<br/>非真实政策</div><small>意见均为原创样例，不代表真实公众态度。</small></aside>
      <div className="text-opinions"><div className="text-tabs" role="tablist" aria-label="意见样例">{OPINIONS.map((o,i)=><button key={o.id} id={`opinion-tab-${o.id}`} role="tab" aria-controls="opinion-panel" aria-selected={i===selected} onClick={()=>choose(i)}><span>{o.id}</span>{o.theme}{saved[o.id]&&<i aria-label="已有运行记录"/>}</button>)}</div>
        <div id="opinion-panel" role="tabpanel" aria-labelledby={`opinion-tab-${OPINIONS[selected].id}`} className="text-quote-panel"><label htmlFor="opinion-text">意见 {OPINIONS[selected].id} <span>可修改措辞，再次判断</span></label><textarea id="opinion-text" aria-label="政策意见原文" maxLength={2000} value={text} onChange={e=>change(e.target.value)}/><div className="text-actions"><button className="text-primary" disabled={busy||!text.trim()} onClick={()=>void run()}>{busy?'正在判断…':'用 Jev 分析这段意见'}</button><button disabled={busy} onClick={()=>change(text===OPINIONS[selected].variant?OPINIONS[selected].text:OPINIONS[selected].variant)}>换一种措辞</button></div><div className="text-result-source" role="status">{busy?'提交独立问题，等待实际返回':result?`${restored?'保存的调用结果':'本次真实调用'} · ${result.model} · ${result.elapsedMs} ms`:'尚未调用模型，结果区保留为空'}</div>{error&&<p className="text-error" role="alert">{error}</p>}</div>
        <div className="text-readouts" aria-live="polite"><div className="text-stance"><span className="text-eyebrow">CHOICE / 总体立场</span><strong>{answers?.stance?.choice?(stanceLabels[answers.stance.choice]??answers.stance.choice):'—'}</strong><small>{answers?.stance?.confidence!==undefined?`confidence ${answers.stance.confidence.toFixed(3)}`:'支持、反对、混合、未表达'}</small></div><div className="text-intention"><span className="text-eyebrow">SCORE / 参与意愿</span><strong>{answers?hasIntention&&answers.intention?.score!==undefined?<>{answers.intention.score.toFixed(2)}<em> / 2</em></>:'未确认表达':'—'}</strong><small>{hasIntention?'0 不参与 · 1 考虑或有条件 · 2 明确计划':'先检查是否表达个人参与意愿'}</small></div></div>
        <div className="text-nouls"><div className="text-nouls-title">NOUL <span>原文表达了这一点的概率</span></div>{metrics.map(metric=><div className="text-noul" key={metric.key}><span>{metric.label}</span><Probability answer={answers?.[metric.key]}/></div>)}</div>
      </div>
    </div>
    <details className="text-method"><summary>判断标准、完整分布与运行记录</summary><p>立场、顾虑和参与计划分别判断。参与意愿的存在概率达到 0.8 时才展示 Score；这是尚未校准的演示阈值。分数与 confidence 不作为行为概率。</p><div className="text-method-grid"><div><h4>本次问题</h4>{Object.entries(TEXT_QUESTIONS).map(([key,q])=><details key={key}><summary>{key} · {q.type}</summary><p>{typeof q.instructions==='string'?q.instructions:JSON.stringify(q.instructions)}</p>{q.criteria&&<pre>{JSON.stringify(q.criteria,null,2)}</pre>}</details>)}</div><div><h4>实际返回</h4>{result?<pre>{JSON.stringify(result.answers,null,2)}</pre>:<p>完成一次调用后显示。没有人工标注集，准确率与校准情况待验证。</p>}</div></div>{Object.keys(saved).length>0&&<div className="text-records"><h4>已运行的意见</h4><table><thead><tr><th>样例</th><th>本次原文</th><th>立场</th><th>模型</th></tr></thead><tbody>{Object.entries(saved).map(([id,entry])=><tr key={id}><td>{id}</td><td>{entry.text}</td><td>{stanceLabels[entry.result.answers.stance?.choice??'']??'未返回'}</td><td>{entry.result.model}</td></tr>)}</tbody></table></div>}</details>
  </section>;
}

