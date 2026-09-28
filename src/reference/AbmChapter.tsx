import {useEffect,useRef,useState} from 'react';
import {Art,Text,Group,Diagram,Ink} from './primitives';
import {AbmTown,Portrait} from './AbmTown';
import {ACTION_NAMES,ACTION_ORDER,ACTION_RESULTS,PROFILE_COPY,residentTurn,totals,differenceMilestones,type ChapterData} from './abm-data';
import timing from '../../production/abm-pages/build/timeline.json';
import './abm-chapter.css';

type Props={page:number;beat:number;active:boolean;data:ChapterData|null;error:string;retry:()=>void;selected:string;onSelect:(id:string)=>void;round:number;setRound:(r:number)=>void;go:(page:number,beat?:number)=>void;experiment:()=>void};
const plate=['11-town-introduction','12-resident-choice','13-town-round','14-policy-comparison'];
function Count({value}:{value:number}){return <span key={value} className="abm-count">{value}</span>}
export function AbmChapter(props:Props){
 const {page,beat,data,error,retry,selected,onSelect,round,setRound,go,experiment}=props;
 const [picker,setPicker]=useState(false),[playing,setPlaying]=useState(false),[compareRound,setCompareRound]=useState(0),[comparePlaying,setComparePlaying]=useState(false),[settledRound,setSettledRound]=useState(0);
 const roster=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setPlaying(false);setPicker(false);setComparePlaying(false)},[page]);
 useEffect(()=>{if(!props.active){setPlaying(false);setComparePlaying(false)}},[props.active]);
 useEffect(()=>{if(picker)roster.current?.showModal();else roster.current?.close()},[picker]);
 useEffect(()=>{if(!playing||page!==2||round>=12){if(round>=12)setPlaying(false);return}const t=setTimeout(()=>setRound(round+1),timing.autoplayRoundMs);return()=>clearTimeout(t)},[playing,page,round,setRound]);
 useEffect(()=>{if(page!==3)return;if(beat===0){setCompareRound(0);setComparePlaying(false)}else if(beat>=2||matchMedia('(prefers-reduced-motion: reduce)').matches){setCompareRound(12);setComparePlaying(false)}else{setCompareRound(0);setComparePlaying(true)}},[page,beat]);
 useEffect(()=>{if(!comparePlaying||page!==3)return;if(compareRound>=12){setComparePlaying(false);return}const t=setTimeout(()=>setCompareRound(r=>r+1),timing.compareRoundMs);return()=>clearTimeout(t)},[comparePlaying,compareRound,page]);
 const closePicker=()=>{setPicker(false);trigger.current?.focus()};
 if(!data)return <section className="abm-loading"><h2>{error?'实验记录暂未载入':'正在展开小镇…'}</h2><p>{error||'读取已保存的 Jev 判断'}</p>{error&&<button onClick={retry}>重新载入</button>}</section>;
 const person=data.profiles.find(p=>p.id===selected)??data.profiles[4];
 const turn=residentTurn(data.yes,round,person.id),tx=turn.transaction,settled=tx?.status==='settled';
 const displayedRound=page===2&&beat===0?round-1:round,frame=data.yes[displayedRound],summary=data.yes[beat===0?0:settledRound].history.at(-1);
 const no=totals(data.no[compareRound]),yes=totals(data.yes[compareRound]),milestones=differenceMilestones(data);
 const nextRound=()=>{if(beat===0)go(12,1);else setRound(Math.min(12,round+1))};
 return <section className={`abm-chapter abm-page-${page}`} aria-label="小镇主体模拟">
  <div className="abm-tools"><button ref={trigger} onClick={()=>{setPlaying(false);setComparePlaying(false);setPicker(true)}}>切换居民 · {person.name}</button><button onClick={experiment}>实验台</button></div>
  <div className="abm-sheet" key={page}>
   {page!==1&&page!==3&&<Art src={`abm/${plate[page]}`}/>}
   {page===1&&<Art src={`abm/${plate[page]}`} box={[0,0,983,730]}/>}
   {page===0&&<>
    <Text x={0} y={74} w={1672} align="center" size={60}><span className="r-red">让 Jev</span> 为小镇居民做选择</Text>
    <Text x={0} y={155} w={1672} align="center" size={30}>八位居民各自行动，观察这些选择怎样改变小镇。</Text>
    <AbmTown frame={data.yes[0]} selected={selected} onSelect={onSelect} intro box={[44,211,1112,623]}/>
    <div className="abm-shop-sign" style={{left:232,top:298,width:120,height:32}}>纸间书店</div><div className="abm-shop-sign" style={{left:559,top:283,width:122,height:33}}>街角剧场</div><div className="abm-shop-sign" style={{left:875,top:307,width:118,height:34}}>南街书店</div>
    <Text x={1190} y={234} w={420} size={67} align="center"><span className="r-red">8</span> 位居民</Text>
    <Text x={1190} y={349} w={420} size={28} align="center">不同的预算、偏好与计划</Text>
    <Text x={1190} y={458} w={420} size={37} align="center">2 家书店 · 1 家剧场</Text>
    <div className="abm-coupon-copy"><Text x={1230} y={585} w={354} size={38} align="center">文化消费券</Text><Text x={1205} y={654} w={411} size={60} align="center" color="var(--r-red)">满 60 减 30</Text><Text x={1200} y={737} w={421} size={28} align="center">每人一张 · 使用一次</Text><Text x={1200} y={778} w={421} size={25} align="center">前 6 轮有效</Text></div>
    <Text x={66} y={839} size={28}>ABM：从每个主体的选择，观察整体变化。</Text>
    <button className="abm-person-next" onClick={()=>go(11)}>看看{person.name}怎么选 →</button>
   </>}
   {page===1&&<>
    <Text x={320} y={118} w={1150} align="center" size={65}>这一轮，<span className="r-red">{person.name}</span>会怎么选？</Text>
    <Text x={330} y={216} w={1150} align="center" size={31}>把个人情况交给 Jev，从四个行动中选择一个。</Text>
    <button className="abm-hero" onClick={()=>setPicker(true)} aria-label={`切换当前居民${person.name}`}><Portrait key={person.id} person={person}/></button>
    <Text x={345} y={280} size={62}>{person.name}</Text><Text x={345} y={354} size={person.archetype.length>6?23:28}>{person.archetype.replace(/者$/,'')}</Text>
    <div key={person.id} className="abm-context">
     <Text x={366} y={421} size={33}>余额 <span className="r-red">{turn.person.cash}</span></Text>
     <Text x={366} y={478} size={Math.min(24,300/PROFILE_COPY[person.id].length)}>{PROFILE_COPY[person.id]}</Text>
     <Text x={366} y={526} size={25}>消费券：{turn.person.couponUsed?'本张已使用':round>6?'已到期':'满 60 减 30'}</Text>
     <Text x={445} y={598} size={26}>{settled?ACTION_NAMES[tx.merchantId as keyof typeof ACTION_NAMES]:'本轮计划'}</Text>
     <Text x={445} y={642} size={25}>{settled?`原价 ${tx.price}，实付 ${tx.cash}`:'保留预算，暂不消费'}</Text>
     {(!settled||tx.merchantId==='T01')&&<div className="abm-context-symbol" aria-hidden="true">{settled?<svg viewBox="0 0 60 60"><path d="M6 13H54V22Q43 29 54 36V46H6V36Q17 29 6 22Z" fill="#e2c4a1" stroke="#755c48" strokeWidth="2"/><path d="M20 14V45" stroke="#a33a20" strokeWidth="2" strokeDasharray="3 3"/><path d="M27 23H46M27 31H46M27 39H40" stroke="#a33a20" strokeWidth="2"/></svg>:<svg viewBox="0 0 60 60"><path d="M15 8H45M15 52H45M20 9C20 22 24 25 30 30C24 35 20 38 20 51M40 9C40 22 36 25 30 30C36 35 40 38 40 51" fill="none" stroke="#61717a" strokeWidth="3"/><path d="M23 47L30 37L37 47Z" fill="#d2ad6f"/></svg>}</div>}
    </div>
    <Text x={743} y={430} w={190} align="center" size={69} color="var(--r-red)">Jev</Text><Text x={743} y={523} w={190} align="center" size={31}>Choice</Text>
    <Diagram><Ink d="M698 487 L734 487" arrow show={beat>=1}/><Ink d="M946 487 L978 487" arrow show={beat>=1}/></Diagram>
    <Group show={beat>=1} className="abm-choice-reveal">
    <Art src={`abm/${plate[page]}`} box={[983,265,677,463]}/>
    <Text x={1023} y={280} size={41}>本轮行动概率</Text>
    <div className={`abm-probabilities ${beat>=1?'revealed':''}`}>
     {ACTION_ORDER.map((action,i)=>{const probability=turn.decision?.probabilities?.[action];return <div className="abm-prob-row" key={action} style={{top:334+i*72}}><span className="abm-action-name">{ACTION_NAMES[action]}</span><span className="abm-track"><i style={{width:`${beat>=1&&probability!==undefined?probability*100:0}%`,background:action==='wait'?'#63717c':action===turn.action?'var(--r-red)':'#6b775d'}}/></span><span className="abm-prob-value">{beat<1?'—':probability===undefined?'—':`${Math.round(probability*100)}%`}</span></div>})}
    </div>
    <Text x={1020} y={650} w={583} size={37} align="center" color="var(--r-red)">选择：{ACTION_RESULTS[turn.action]}</Text>
    </Group>
    <Group show={beat>=2} className="abm-payment">
     <Art src={`abm/${plate[page]}`} box={[22,730,1627,111]}/>
     <Text x={172} y={757} w={350} align="center" size={43}>{settled?<>自付 <span className="r-blue">{tx.cash}</span></>:'本轮暂不消费'}</Text>
     <Text x={575} y={751} size={53}>{settled?'＋':'→'}</Text><Text x={680} y={757} w={320} align="center" size={43}>{settled?<>补贴 <span className="r-red">{tx.subsidy}</span></>:'保留预算'}</Text>
     <Text x={1080} y={751} size={53}>{settled?'＝':'→'}</Text><Text x={1180} y={757} w={354} align="center" size={43}>{settled?<>成交 <span className="r-green">{tx.price}</span></>:`余额 ${turn.person.cash}`}</Text>
    </Group>
    <Text x={380} y={839} w={1000} align="center" size={22}>{turn.decision?.source==='live'?'保存的 Jev 判断':'约束检查后的等待'} · 第 {round} 轮 · 有券情景 · 模拟货币</Text>
   </>}
   {page===2&&<>
    <Text x={0} y={77} w={1672} align="center" size={58}>八个人的选择，让小镇运转起来</Text><Text x={0} y={153} w={1672} align="center" size={29}>居民作出选择，交易逐笔发生，小镇进入下一轮。</Text>
    <AbmTown frame={frame} selected={selected} onSelect={onSelect} box={[69,202,1170,618]} onSettled={setSettledRound}/>
    {(['B01','T01','B02'] as const).map((id,i)=><Text key={id} x={196+i*367} y={222} w={235} size={24} align="center">{ACTION_NAMES[id]} · {summary?.transactions.filter(t=>t.status==='settled'&&t.merchantId===id).length??0} 笔</Text>)}
    <Text x={1306} y={177} w={290} align="center" size={30}>第 <span className="abm-round-number">{round}</span> 轮 / 12</Text>
    {[{v:summary?.units??0,label:'笔成交'},{v:summary?.revenue??0,label:'本轮交易额'},{v:summary?.subsidy??0,label:'消费券核销'}].map((metric,i)=><div key={metric.label}><Text x={1400} y={337+i*151} w={195} align="center" size={66} color={i===2?'var(--r-red)':'var(--r-ink)'}><Count value={metric.v}/></Text><Text x={1380} y={424+i*151} w={224} size={27} align="center">{metric.label}</Text></div>)}
    <Text x={1290} y={790} size={20}>Jev 保存实验 · 模拟货币</Text>
    <div className="abm-timeline" aria-label="选择实验轮次">{Array.from({length:12},(_,i)=><button key={i} aria-label={`第${i+1}轮`} aria-current={displayedRound===i+1?'step':undefined} onClick={()=>{setPlaying(false);setRound(i+1);if(beat===0)go(12,1)}}><span>{i+1}</span>{i===5&&<small>消费券到期</small>}</button>)}</div>
    <button className="abm-round-next" disabled={beat>0&&round===12} onClick={nextRound}>{beat===0?'开始这一轮':round===12?'12 轮结束':'下一轮 →'}</button>
    <button className="abm-play" onClick={()=>{if(round===12)setRound(1);if(beat===0)go(12,1);setPlaying(!playing)}}>{playing?'暂停回放':'连续回放'}</button>
    <button className="abm-selected-detail" onClick={()=>go(11,2)}>查看{person.name}这一轮的判断 ↗</button>
   </>}
   {page===3&&<>
    <Text x={0} y={75} w={1672} align="center" size={62}>发放消费券，<span className="r-red">改变了什么？</span></Text><Text x={0} y={153} w={1672} align="center" size={29}>同一组居民、相同的初始条件，对比两种情景。</Text>
    <div className={`abm-compare-worlds ${beat===0?'at-intro':''}`}>
    <Art src={`abm/${plate[page]}`} box={[28,188,1620,377]}/>
    <Text x={79} y={210} size={41} color="var(--r-blue)">不发消费券</Text><Text x={880} y={210} size={41} color="var(--r-red)">发放消费券</Text>
    <AbmTown frame={data.no[compareRound]} selected={selected} onSelect={onSelect} compact box={[72,262,465,276]}/><AbmTown frame={data.yes[compareRound]} selected={selected} onSelect={onSelect} compact box={[872,262,465,276]}/>
    <Group show={compareRound===0} className="abm-compare-premise">
     <Text x={554} y={288} w={240} align="center" size={37} color="var(--r-blue)">原有预算</Text><Text x={554} y={407} w={240} align="center" size={29}>按各自计划消费</Text>
     <Text x={1354} y={288} w={240} align="center" size={37} color="var(--r-red)">文化消费券</Text><Text x={1354} y={407} w={240} align="center" size={29}>每人满 60 减 30</Text>
    </Group>
    <Group show={compareRound>0} className="abm-compare-totals">{[no,yes].map((result,i)=><div key={i}><Text x={553+i*801} y={264} w={156} align="center" size={102} color={i?'var(--r-red)':'var(--r-blue)'}><Count value={result.units}/></Text><Text x={703+i*801} y={308} size={27}>件成交</Text><Text x={550+i*801} y={391} w={225} align="center" size={94} color={i?'var(--r-red)':'var(--r-blue)'}><Count value={result.revenue}/></Text><Text x={565+i*801} y={503} w={210} align="center" size={29}>累计交易额</Text></div>)}</Group>
    </div>
    <Group show={beat===0} className="abm-compare-opening"><Text x={0} y={764} w={1672} align="center" size={34}>只改变一件事：<span className="r-red">是否发放消费券</span></Text><Text x={0} y={819} w={1672} align="center" size={24} color="#786d5b">点击，观察两座小镇接下来的 12 轮</Text></Group>
    <Group show={beat===1} className="abm-compare-progress">
     <Text x={0} y={604} w={1672} align="center" size={35}>{compareRound===12?'12 轮结束，接下来看看差异':'让两座小镇，同步走过 12 轮'}</Text>
     <div className="abm-paired-track"><i style={{width:`${compareRound/12*100}%`}}/>{Array.from({length:12},(_,i)=><span key={i} className={compareRound>=i+1?'passed':''} style={{left:`${(i+1)/12*100}%`}}><b>{i+1}</b></span>)}</div>
     <Text x={0} y={770} w={1672} align="center" size={27} color="#786d5b">{compareRound===12?'再次点击，展开成交差异与关键轮次':'相同的时间推进，相同的交易规则'}</Text>
    </Group>
    <Group show={beat>=2&&compareRound===12} className="abm-compare-conclusion">
     <Art src={`abm/${plate[page]}`} box={[28,565,1620,310]}/>
     <Text x={77} y={579} size={39}>差异出现在什么时候？</Text>
     {milestones.map((event,i)=><div key={event.round}><Text x={100+i*727} y={648} w={340} align="center" size={34}>第 {event.round} 轮</Text><Text x={100+i*727} y={702} w={340} align="center" size={27}>有券组累计多成交</Text><Text x={100+i*727} y={753} w={340} align="center" size={54} color="var(--r-red)">{event.difference} 件</Text></div>)}
     <Text x={480} y={669} w={310} align="center" size={28}>第 6 轮：消费券到期</Text><Diagram><Ink d="M482 742 L785 742" color="var(--r-red)" arrow/></Diagram>
     <Text x={1243} y={580} w={350} size={33} align="center">本组模拟差异</Text><Text x={1250} y={636} w={339} size={44} align="center" color="var(--r-red)">+{totals(data.yes[12]).units-totals(data.no[12]).units} 件成交</Text><Text x={1250} y={695} w={339} size={43} align="center" color="var(--r-red)">+{totals(data.yes[12]).revenue-totals(data.no[12]).revenue} 交易额</Text><Text x={1248} y={778} w={340} size={27} align="center">消费券核销 {totals(data.yes[12]).subsidy}</Text>
    </Group>
    <Text x={1219} y={842} size={18}>来源：第17组 Jev 保存实验 · 12轮 · 模拟货币</Text>
    <button className="abm-compare-replay" onClick={()=>{if(compareRound===12||beat===0){setCompareRound(0);if(beat!==1)go(13,1);setComparePlaying(true)}else setComparePlaying(!comparePlaying)}}>{beat===0?'开始对照 →':`${comparePlaying?'暂停':'同步回放'} · 第 ${compareRound} / 12 轮`}</button>
   </>}
  </div>
  <dialog ref={roster} className="abm-roster" aria-label="选择小镇居民" onCancel={e=>{e.preventDefault();closePicker()}} onKeyDown={e=>e.stopPropagation()} onClick={e=>{if(e.target===e.currentTarget)closePicker()}}>
   <button className="r-close" onClick={closePicker} aria-label="关闭居民选择">×</button><h2>这次，看看谁的选择？</h2><p>八位居民都可以选择，后续页面会沿用同一位居民。</p><div className="abm-roster-grid">{data.profiles.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>{onSelect(p.id);closePicker()}}><Portrait person={p}/><strong>{p.name}</strong><span>{p.archetype}</span><small>{PROFILE_COPY[p.id]}</small></button>)}</div>
  </dialog>
 </section>;
}
