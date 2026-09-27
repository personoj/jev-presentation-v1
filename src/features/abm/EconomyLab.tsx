import {useEffect,useRef,useState} from 'react';
import type {FeatureProps} from '../../shared/types';
import {APIError,evaluate} from '../../shared/api';
import {ACTIONS,audit,createEconomy,ruleDecisions,settleRound,visibleState,type Economy} from './engine';
import {decisionRequest,modelDecision} from './model';
import {TownWorld} from './TownWorld';
import {PersonaPanel,ResidentPortrait} from './PersonaPanel';
import './economy.css';

type SavedRun={id:string;protocolVersion:'personas8-v1';seed:number;policy:boolean;mode:'rules'|'jev';state:Economy;snapshots?:Economy[];requests?:number};
type Archive={schemaVersion:number;description:string;runs:SavedRun[];createdAt?:string};
type ExperimentMode='experiment'|'compare';
let retained=createEconomy(17,true),retainedFrames=[retained];
let retainedLabel='本机固定规则运行',retainedReplay:SavedRun|undefined,retainedReplayIndex=0,quotaLatched=false;
const money=(n:number)=>n.toLocaleString('zh-CN');
const sumCash=(s:Economy)=>s.history.reduce((n,h)=>n+h.cash,0);
const income=(s:Economy)=>s.merchants.reduce((n,m)=>n+m.revenue,0);
const units=(s:Economy)=>s.history.at(-1)?.cumulativeUnits||0;
const signed=(n:number)=>(n>0?'+':'')+money(n);
function frameAt(run:SavedRun,index:number){const frame=run.snapshots?.[index]||run.state;return {...frame,history:run.state.history.slice(0,frame.round)}}

export function EconomyLab({onRecord,onQuota,view='run'}:FeatureProps&{view?:'setup'|'run'|'compare'}){
 const [state,setState]=useState<Economy>(retained),[selected,setSelected]=useState('R01');
 const [mode,setMode]=useState<ExperimentMode>(view==='compare'?'compare':'experiment');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[label,setLabel]=useState(retainedLabel);
 const [archive,setArchive]=useState<Archive>(),[archiveError,setArchiveError]=useState(false),[pair,setPair]=useState<'rules'|'jev'>('rules'),[pairSeed,setPairSeed]=useState(retained.seed);
 const [cumulative,setCumulative]=useState(true),[details,setDetails]=useState(false);
 const [replay,setReplay]=useState<SavedRun|undefined>(retainedReplay),[replayIndex,setReplayIndex]=useState(retainedReplayIndex);
 const [localFrames,setLocalFrames]=useState(retainedFrames),[playing,setPlaying]=useState(false);
 const [comparisonIndex,setComparisonIndex]=useState(0),[comparePlaying,setComparePlaying]=useState(false);
 const cancel=useRef<AbortController|null>(null),version=useRef(0),worker=useRef<Worker|null>(null);
 useEffect(()=>{
  const archiveAbort=new AbortController();
  fetch('/data/experiments.json',{signal:archiveAbort.signal}).then(r=>{if(!r.ok)throw new Error('保存文件未加载');return r.json()}).then(data=>{
   if(data?.schemaVersion!==2||!Array.isArray(data.runs))throw new Error('保存文件格式不匹配');
   const runs=data.runs.filter((r:SavedRun)=>r.protocolVersion==='personas8-v1'&&r.state?.round===12&&r.state.residents?.length===8&&r.state.residents.every(person=>person.profile)&&r.snapshots?.length===13);
   if(!runs.length)throw new Error('没有完整的八人版轨迹');setArchive({...data,runs});
  }).catch(()=>{if(!archiveAbort.signal.aborted)setArchiveError(true)});
  worker.current=new Worker(new URL('./engine.worker.ts',import.meta.url),{type:'module'});
  return()=>{archiveAbort.abort();cancel.current?.abort();worker.current?.terminate();version.current++};
 },[]);
 function changeMode(next:ExperimentMode){cancel.current?.abort();version.current++;setBusy(false);setPlaying(false);setComparePlaying(false);setMode(next);setMessage('')}
 function commit(next:Economy,source:string){retained=next;retainedLabel=source;setState(next);setLabel(source)}
 function reset(policy=state.policy,seed=state.seed){
  cancel.current?.abort();version.current++;setBusy(false);setReplay(undefined);retainedReplay=undefined;setPlaying(false);setMessage('');
  const initial=createEconomy(seed,policy);retainedFrames=[initial];setLocalFrames([initial]);setReplayIndex(0);retainedReplayIndex=0;commit(initial,'本机固定规则运行');
 }
 async function step(live=false){
  if(state.round>=12||busy||replay||state.round<localFrames.length-1||(live&&quotaLatched))return;
  const current=++version.current;setBusy(true);setPlaying(false);setMessage('');let decisions=ruleDecisions(state);
  let source=state.history.some(h=>h.decisions.some(d=>d.source==='live'))?'本机混合轨迹 · 本轮为固定规则':'本机固定规则运行';
  try{
   if(live){
    const id=selected.startsWith('R')?selected:'R01',req=decisionRequest(state,id);cancel.current=new AbortController();
    setMessage(`正在请求 ${state.residents.find(r=>r.id===id)?.profile.name||id} 的行动；本轮尚未结算。`);
    const result=await evaluate(req.state,req.questions,{signal:cancel.current.signal,stateVersion:current});if(current!==version.current)return;
    const decision=modelDecision(id,req.state,result);decisions=decisions.map(d=>d.residentId===id?decision:d);
    source=`单人 Jev 实验 · ${state.residents.find(r=>r.id===id)?.profile.name||id} 使用模型，其余为规则`;
    onRecord?.({id:result.requestId,label:`ABM 第 ${state.round+1} 轮 ${id}`,at:new Date().toISOString(),input:req,output:result,source:'live'});
   }
   const next=await new Promise<Economy>((resolve,reject)=>{const w=worker.current;if(!w){resolve(settleRound(state,decisions));return}w.onmessage=e=>{if(e.data.id!==current)return;e.data.error?reject(new Error(e.data.error)):resolve(e.data.state)};w.onerror=()=>reject(new Error('模拟工作线程未完成'));w.postMessage({id:current,state,decisions})});
   if(current!==version.current)return;const issues=audit(next);if(issues.length)throw new Error(issues.join('；'));
   commit(next,source);retainedFrames=[...localFrames,next];setLocalFrames(retainedFrames);setReplayIndex(next.round);retainedReplayIndex=next.round;
   setMessage(`第 ${next.round} 轮已结算，${next.history.at(-1)?.units||0} 笔成交，账目检查通过。`);
   if(!live)onRecord?.({id:crypto.randomUUID(),label:`ABM 规则第 ${next.round} 轮`,at:new Date().toISOString(),input:{seed:state.seed,policy:state.policy,round:state.round+1},output:next.history.at(-1),source:'rules'});
  }catch(error){if(current!==version.current)return;if(error instanceof APIError&&(/QUOTA|BALANCE|CREDIT|BUDGET/i.test(error.code)||error.status===402)){quotaLatched=true;onQuota?.(error.message)}setMessage(error instanceof Error?error.message:'请求失败；本轮没有结算')}
  finally{if(current===version.current)setBusy(false)}
 }
 function showFrame(index:number,run=replay){setReplayIndex(index);retainedReplayIndex=index;if(run)commit(frameAt(run,index),`保存实验回放 · ${run.mode==='jev'?'8 人及商家由 Jev 决策':'全体固定规则'}`);else{const frame=localFrames[index];if(frame)commit(frame,'本机已计算轨迹回放')}}
 function load(run:SavedRun,index=0){
  cancel.current?.abort();version.current++;setBusy(false);setPlaying(false);setComparePlaying(false);setReplay(run);retainedReplay=run;showFrame(index,run);setMode('experiment');
  setMessage('正在检查完整保存实验。回放只读取已有状态，不发送模型请求。');
  onRecord?.({id:crypto.randomUUID(),label:`ABM 回放 ${run.id}`,at:new Date().toISOString(),input:{run:run.id,index},output:{round:index},source:'replay'});
 }
 const frameCount=replay?.snapshots?.length||localFrames.length;
 useEffect(()=>{if(!playing)return;if(replayIndex>=frameCount-1){setPlaying(false);return}const timer=setTimeout(()=>showFrame(replayIndex+1),2600);return()=>clearTimeout(timer)},[playing,replayIndex,frameCount,replay]);
 useEffect(()=>{if(!comparePlaying)return;if(comparisonIndex>=12){setComparePlaying(false);return}const timer=setTimeout(()=>setComparisonIndex(n=>n+1),2600);return()=>clearTimeout(timer)},[comparePlaying,comparisonIndex]);
 function togglePlayback(){if(playing){setPlaying(false);return}if(replayIndex>=frameCount-1)showFrame(0);setPlaying(true)}
 const resident=state.residents.find(r=>r.id===selected),merchant=state.merchants.find(m=>m.id===selected),last=state.history.at(-1);
 const transaction=last?.transactions.find(t=>t.residentId===selected),decision=last?.decisions.find(d=>d.residentId===selected);
 const metrics=[['成交件数',units(state)],['居民支付',sumCash(state)],['财政核销',state.government.spent],['商家收入',income(state)]] as const;
 const pairs=(archive?.runs.filter(r=>r.mode===pair&&r.seed===pairSeed)||[]).sort((a,b)=>Number(a.policy)-Number(b.policy));
 const compared=pairs.map(run=>({run,state:frameAt(run,comparisonIndex)}));
 const chartMax=Math.max(1,...pairs.flatMap(r=>r.state.history.map(h=>cumulative?h.cumulativeRevenue:h.revenue)));
 const seeds=[...new Set(archive?.runs.map(r=>r.seed)||[17,29,43])].sort((a,b)=>a-b);
 const isPast=!replay&&state.round<localFrames.length-1;
 const selectedName=resident?.profile.name||state.residents[0].profile.name;
 const comparisonPerson=compared[1]?.state.residents.find(r=>r.id===selected);
 return <div className="economy-lab town-lab town-free-lab">
  <div className="town-mode-bar"><div className="town-mode-switch" role="tablist" aria-label="小镇实验模式"><button role="tab" aria-selected={mode==='experiment'} aria-controls="town-free-experiment" id="town-free-tab" onClick={()=>changeMode('experiment')}>自由实验</button><button role="tab" aria-selected={mode==='compare'} aria-controls="town-policy-comparison" id="town-compare-tab" onClick={()=>changeMode('compare')}>政策对照</button></div><span>8 种性格 · 同一条文化街</span><button className="town-method-button" onClick={()=>setDetails(!details)} aria-expanded={details}>{details?'收起方法':'方法与账目'} ↗</button></div>

  <section id="town-free-experiment" role="tabpanel" aria-labelledby="town-free-tab" hidden={mode!=='experiment'}>
   <div className="town-experiment-toolbar"><div className="town-policy-switch"><label><input type="checkbox" checked={state.policy} onChange={e=>reset(e.target.checked)}/><span>文化消费券 <b>{state.policy?'已开启':'未发放'}</b></span></label><small>满 60 减 30 · 每人一次 · 第 6 轮到期</small></div><label className="town-seed-picker">种子 <select aria-label="自由实验种子" value={state.seed} onChange={e=>reset(state.policy,Number(e.target.value))}>{seeds.map(seed=><option key={seed} value={seed}>{seed}</option>)}</select></label><button onClick={()=>reset()}>重置</button><div className="town-controls"><button disabled={busy||state.round>=12||!!replay||isPast} onClick={()=>step(false)}>全体按规则推进 →</button><button className="primary" disabled={busy||state.round>=12||!!replay||isPast||quotaLatched} onClick={()=>step(true)}>{busy?'等待判断…':`让 Jev 判断${selectedName}`}</button></div></div>
   <div className="town-simulation-grid">
    <div className="town-map-stage"><TownWorld state={state} selected={selected} onSelect={setSelected}/><span className="town-source town-current-source"><i/>{label}</span>
     <p className="town-status" role="status">{message||'点击居民查看性格。现场 Jev 按钮只判断选中一人，其余 7 人和商家按规则运行。'}</p>
     <div className="town-saved-controls"><label>完整实验 <select aria-label="选择保存记录" value={replay?.id||''} disabled={!archive?.runs.length} onChange={e=>{const run=archive?.runs.find(r=>r.id===e.target.value);if(run)load(run)}}><option value="">{archive?.runs.length?'选择八人完整保存轨迹':archiveError?'八人版保存实验暂未加载':'正在读取八人版保存实验…'}</option>{archive?.runs.map(run=><option key={run.id} value={run.id}>{run.mode==='jev'?'Jev 全体':'规则全体'} · {run.policy?'有券':'无券'} · seed {run.seed}</option>)}</select></label><span>完整 Jev 轨迹包括 8 人及商家判断。</span></div>
     {frameCount>1&&<div className="town-replay-bar"><button disabled={busy} onClick={togglePlayback}>{playing?'暂停':'回放'} {playing?'Ⅱ':'▷'}</button><span>第 <b>{state.round}</b> / {frameCount-1} 轮</span><input aria-label="回放轮次" disabled={busy} type="range" min="0" max={frameCount-1} value={replayIndex} onChange={e=>{setPlaying(false);showFrame(Number(e.target.value))}}/>{replay?<button onClick={()=>reset()}>退出保存回放</button>:isPast?<button onClick={()=>showFrame(frameCount-1)}>回到最新</button>:<small>回放不发请求</small>}</div>}
     <div className="town-totals"><span>第 {state.round} 轮累计 · 模拟货币</span><div>{metrics.map(([key,value])=><div key={key}><strong>{money(value)}</strong><span>{key}</span></div>)}</div></div>
    </div>
    <aside className="town-character-aside"><div className="town-persona-strip" aria-label="八位居民，点击比较性格">{state.residents.map(r=><button key={r.id} onClick={()=>setSelected(r.id)} aria-pressed={selected===r.id} aria-label={`查看${r.profile.name}，${r.profile.archetype}`}><ResidentPortrait resident={r} small/><span><strong>{r.profile.name}</strong><small>{r.profile.archetype}</small></span></button>)}</div>{resident?<PersonaPanel resident={resident} decision={decision} transaction={transaction} round={state.round} policy={state.policy} onInspect={()=>setDetails(!details)}/>:<section className="town-merchant-panel"><span>经营主体 · {merchant?.id}</span><h3>{merchant?.name}</h3><p>{merchant?.kind==='book'?'根据销售和库存决定是否补货。':'根据当轮销量调整下一轮票价。'}</p><div className="persona-facts"><span>价格 <b>{merchant?.price}</b></span><span>{merchant?.kind==='book'?'库存':'余座'} <b>{merchant?.stock}</b></span><span>现金 <b>{merchant?.cash}</b></span><span>收入 <b>{merchant?.revenue}</b></span><span>成本 <b>{merchant?.cost}</b></span><span>已售 <b>{merchant?.sold}</b></span></div><div className="town-verdict"><span>下一轮准备</span><strong>{merchant?.nextAction}</strong></div><button className="town-link-button" onClick={()=>setDetails(!details)}>检查经营输入与账目 ↗</button><p className="town-merchant-tip">点上方人物，回到居民的性格与行动。</p></section>}</aside>
   </div>
  </section>
  <section id="town-policy-comparison" role="tabpanel" aria-labelledby="town-compare-tab" hidden={mode!=='compare'}>
   <div className="town-controls town-compare-controls"><label>决策机制 <select aria-label="对照决策机制" value={pair} onChange={e=>{setPair(e.target.value as 'rules'|'jev');setComparePlaying(false)}}><option value="rules">全体固定规则</option><option value="jev">全体 Jev 保存实验</option></select></label><label>配对种子 <select aria-label="对照种子" value={pairSeed} onChange={e=>{setPairSeed(Number(e.target.value));setComparePlaying(false)}}>{seeds.map(seed=><option key={seed}>{seed}</option>)}</select></label><span>同样的 8 个人，只有消费券不同。</span></div>
   {pairs.length===2?<div className="town-comparison">
    <div className="town-pair">{compared.map(({run,state:frame})=><article key={run.id} className={`town-pair-world ${run.policy?'with-policy':''}`}><header><div><span>{run.mode==='jev'?'J':'R'}{run.policy?'1':'0'}</span><h3>{run.policy?'发放消费券':'不发消费券'}</h3></div><strong>{money(income(frame))}<small> 累计交易额</small></strong></header><TownWorld state={frame} selected={selected} onSelect={setSelected} compact/><div className="town-pair-numbers"><span><b>{units(frame)}</b> 件成交</span><span>居民支付 <b>{money(sumCash(frame))}</b></span><span>核销 <b>{frame.government.spent}</b></span></div><div className="town-pair-selected">{selected.startsWith('R')?(()=>{const r=frame.residents.find(r=>r.id===selected),d=frame.history.at(-1)?.decisions.find(d=>d.residentId===selected);return <><b>{r?.profile.name}</b><span>余额 {r?.cash} · {d?ACTIONS[d.action]:'尚未决策'}</span></>})():(()=>{const m=frame.merchants.find(m=>m.id===selected);return <><b>{m?.name}</b><span>价格 {m?.price} · 库存 {m?.stock} · 收入 {m?.revenue}</span></>})()}</div><button className="town-link-button" onClick={()=>load(run,comparisonIndex)}>在自由实验中检查这条轨迹 ↗</button></article>)}</div>
    <div className="town-replay-bar"><button onClick={()=>{if(comparePlaying)setComparePlaying(false);else{if(comparisonIndex>=12)setComparisonIndex(0);setComparePlaying(true)}}}>{comparePlaying?'暂停回放':'播放双镇回放'} {comparePlaying?'Ⅱ':'▷'}</button><span>第 <b>{comparisonIndex}</b> / 12 轮</span><input aria-label="配对回放轮次" type="range" min="0" max="12" value={comparisonIndex} onChange={e=>{setComparePlaying(false);setComparisonIndex(Number(e.target.value))}}/><small>保存快照 · 不发请求</small></div>
    <div className="town-comparison-bottom"><div className="town-difference"><span>截至本轮 · 有券 − 无券</span><strong>{signed(income(compared[1].state)-income(compared[0].state))}<small> 交易额</small></strong><p><b>{signed(units(compared[1].state)-units(compared[0].state))}</b> 件成交　<span>现金支出 {signed(sumCash(compared[1].state)-sumCash(compared[0].state))}</span></p><small>这是虚构实验中的差值，不是现实政策效应。</small></div><div className="town-trajectory"><div className="town-chart-heading"><span>12 轮收入轨迹</span><button onClick={()=>setCumulative(!cumulative)}>{cumulative?'累计':'当期'}收入 ↔</button></div><svg viewBox="0 0 840 210" role="img" aria-label="配对模拟收入轨迹"><line x1="48" y1="176" x2="810" y2="176"/><line x1="48" y1="20" x2="48" y2="176"/><rect x="426" y="20" width="384" height="156" fill="currentColor" opacity=".025"/><text x="437" y="17">券到期后观察</text>{[0,.5,1].map(f=><g key={f}><text x="5" y={180-f*145}>{Math.round(chartMax*f)}</text><line x1="48" y1={176-f*145} x2="810" y2={176-f*145} opacity=".12"/></g>)}{pairs.map(run=><polyline key={run.id} points={(cumulative?'48,176 ':'')+run.state.history.map(h=>`${48+h.round*63},${176-(cumulative?h.cumulativeRevenue:h.revenue)/chartMax*145}`).join(' ')} fill="none" stroke={run.policy?'var(--accent)':'#596c73'} strokeWidth="3"/>)}<line x1={48+comparisonIndex*63} x2={48+comparisonIndex*63} y1="20" y2="176" stroke="var(--ink)" strokeDasharray="4 4"/>{[0,3,6,9,12].map(n=><text key={n} x={44+n*63} y="202">{n}</text>)}</svg><div className="town-chart-legend"><span>有券</span><span>无券</span><span>横轴：抽象决策轮次</span></div></div></div>
    {comparisonPerson&&<div className="town-comparison-person"><PersonaPanel resident={comparisonPerson} decision={compared[1].state.history.at(-1)?.decisions.find(d=>d.residentId===selected)} transaction={compared[1].state.history.at(-1)?.transactions.find(t=>t.residentId===selected)} round={comparisonIndex} policy onInspect={()=>setDetails(!details)}/><p>此处显示有券世界的状态；两个地图同步选中同一人。</p></div>}
    <details className="town-seed-details"><summary>三组种子，检查差异是否稳定</summary><table><caption>同一决策机制下，有券减去无券</caption><thead><tr><th>种子</th><th>成交件数</th><th>12 轮交易额</th><th>居民现金支出</th></tr></thead><tbody>{seeds.map(seed=>{const no=archive?.runs.find(r=>r.seed===seed&&r.mode===pair&&!r.policy)?.state,yes=archive?.runs.find(r=>r.seed===seed&&r.mode===pair&&r.policy)?.state;if(!no||!yes)return null;return <tr key={seed}><td>{seed}</td><td>{signed(units(yes)-units(no))}</td><td>{signed(income(yes)-income(no))}</td><td>{signed(sumCash(yes)-sumCash(no))}</td></tr>})}</tbody></table><p>{archive?.description} 这三组结果不用于估计现实政策效果。</p></details>
   </div>:<div className="town-empty"><strong>{archiveError?'八人版保存实验暂未加载':'正在读取八人版保存实验'}</strong><p>对照需要相同人物设定、完整的 12 轮轨迹与模型返回。加载完成后再展示结果。</p></div>}
  </section>
  {details&&<div className="town-method"><h4>性格怎样进入实验</h4><p>8 位固定居民、2 家书店、1 家剧场，12 个抽象周期。人物性格、动机与行为系数由研究者预设，同一人物在不同种子和政策世界中保持一致。种子只控制初始化的小幅差异与结算顺序。地图步行是行动可视化，不作为额外的经济机制。</p><p>规则按偏好、计划时点、自付价格、距离与已购数量计算效用；价格、距离、计划分别乘以人物档案中的系数。Jev 读取该人物的性格、私有状态及公开市场，输出允许范围内的行动。人物档案是实验条件，不是模型事后解释出来的心理。</p><p>每轮冻结状态 → 居民判断 → 固定种子排序解决库存竞争 → 约束检查与结算 → 商家调整。书店各 4 本、剧场 6 座；居民每轮至多买一件，累计至多 2 本书和 1 张票；财政预算 240，消费券前 6 轮有效。</p><p>居民现金 ＋ 财政补贴 ＝ 商家交易收入。补货和戏票服务成本进入外部供给账户。现场 Jev 按钮仅验证选中一人；完整 Jev 存档包含 8 位居民及需要经营调整的商家，按返回选项概率的最大值选择动作，完全相同的可见输入可复用已保存响应。</p><pre>{JSON.stringify(mode==='compare'?{protocol:'personas8-v1',seed:pairSeed,mode:pair,round:comparisonIndex,selected}:resident?{nextRoundVisible:state.round<12?visibleState(state,resident.id):null,lastDecision:decision,lastTransaction:transaction}:{merchant,lastMerchantDecision:last?.merchantDecisions?.find(d=>d.merchantId===selected),ledger:state.government,supplier:state.supplier,audit:audit(state)},null,2)}</pre></div>}
 </div>;
}
export default EconomyLab;
