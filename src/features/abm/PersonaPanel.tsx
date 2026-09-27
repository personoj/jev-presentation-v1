import type {CSSProperties} from 'react';
import {ACTIONS,type Decision,type Resident,type Transaction} from './engine';

export function ResidentPortrait({resident,small=false}:{resident:Resident;small?:boolean}){
 const index=resident.profile.spriteIndex;
 return <span className={`persona-portrait ${small?'is-small':''}`} role="img" aria-label={`${resident.profile.name}的像素形象`} style={{'--portrait-x':`${(index%4)*100/3}%`,'--portrait-y':`${Math.floor(index/4)*100}%`} as CSSProperties}/>;
}

export function PersonaPanel({resident,decision,transaction,round,policy,onInspect}:{resident:Resident;decision?:Decision;transaction?:Transaction;round:number;policy:boolean;onInspect:()=>void}){
 const p=resident.profile;
 const sensitivities=[['价格敏感',p.priceSensitivity],['距离敏感',p.distanceSensitivity],['计划坚持',p.planningWeight]] as const;
 return <section className="persona-panel" aria-label={`${p.name}的性格与本轮行动`}>
  <header className="persona-heading"><ResidentPortrait resident={resident}/><div><span>{resident.id} · {p.archetype}</span><h3>{p.name}</h3><div className="persona-traits">{p.traits.map(trait=><span key={trait}>{trait}</span>)}</div></div></header>
  <p className="persona-summary">{p.summary}</p>
  <div className="persona-intent"><span>在意什么</span><p>{p.motive}</p><span>如何决定</span><p>{p.decisionStyle}</p></div>
  <div className="persona-sensitivities" aria-label="规则中的性格参数，相对基准倍率">{sensitivities.map(([name,value])=><div key={name}><span>{name}</span><i><b style={{width:`${Math.min(100,value/2.5*100)}%`}}/></i><strong>{value.toFixed(2)}<small>×</small></strong></div>)}</div>
  <div className="persona-facts"><span>余额 <b>{resident.cash}</b></span><span>券 <b>{resident.couponUsed?'已使用':policy&&round<6?'待使用':'不可用'}</b></span><span>购书偏好 <b>{resident.bookPreference}</b><small>/100</small></span><span>戏剧偏好 <b>{resident.theatrePreference}</b><small>/100</small></span></div>
  <div className={`town-verdict ${transaction?.status||'initial'}`}><span>{transaction?.status==='settled'?'本轮已成交':transaction?.status==='rejected'?'程序拒绝执行':transaction?.status==='error'?'本轮判断失败':decision?'本轮行动':'等待首轮行动'}<em>{decision?(decision.source==='live'?'Jev':'规则'):''}</em></span><strong>{decision?ACTIONS[decision.action]:'选择一种推进方式，观察他／她的去向'}</strong>{transaction&&<p>{transaction.status==='settled'?`自付 ${transaction.cash} ＋ 补贴 ${transaction.subsidy} ＝ 交易 ${transaction.price}`:transaction.reason}</p>}</div>
  {decision?.probabilities&&<div className="town-probability-row" aria-label="选中居民的模型行动概率">{Object.entries(decision.probabilities).map(([action,probability])=><span key={action}>{action==='wait'?'等待':action==='B01'?'纸间':action==='B02'?'南街':'剧场'} <b>{Math.round(probability*100)}%</b></span>)}</div>}
  <footer><span>人物与性格为实验预设；1× 为规则基准。</span><button className="town-link-button" onClick={onInspect}>查看模型输入与账目 ↗</button></footer>
 </section>;
}
