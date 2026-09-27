import {useState} from 'react';
import type {RecordEvent} from '../shared/types';
import './research.css';
const studies=[
 {name:'跟读辅助',question:'容忍识别错字，会不会也放过插话？',sample:'同一批录音，保留原稿、停顿、插话和识别错误。',contrast:['只做局部文本对齐','局部对齐 + Jev 复核'],metrics:['误推进次数','回到原稿所需时间','端到端响应延迟'],decision:'先保证插话时不误推进，再考察错字容忍与响应速度。',route:'录音 → 两条处理路径 → 逐时刻比对'},
 {name:'政策文本',question:'同一种立场，换种措辞还会得到相近判断吗？',sample:'邀请两位研究者独立编码，保留分歧；为同一意见编写措辞变体。',contrast:['研究者的独立编码','Jev 的固定问题与等级'],metrics:['逐项一致性','措辞变体稳定性','未表达内容的误判'],decision:'先明确“文本表达了什么”，再讨论这些变量如何进入行为模型。',route:'原文 / 改写 → 固定编码表 → 分歧审查'},
 {name:'主体行为',question:'消费券促成新消费，还是让原计划提前发生？',sample:'从相同居民、预算与商家库存出发，运行有券/无券的配对实验。',contrast:['固定规则 × 有券 / 无券','Jev 决策 × 有券 / 无券'],metrics:['累计购买件数','消费发生的轮次','财政支出与商家收益'],decision:'先校准主体行为与约束，再增加种子、替换参数、检查结论是否稳定。',route:'同一初始小镇 → 四个实验条件 → 配对轨迹'}
];
export function ResearchAgenda({records,onInspect}:{records:RecordEvent[];onInspect:()=>void}){
 const [selected,setSelected]=useState(2);const study=studies[selected];
 return <section className="agenda"><nav className="agenda-tabs" aria-label="选择验证任务">{studies.map((s,i)=><button key={s.name} aria-pressed={i===selected} onClick={()=>setSelected(i)}><span>0{i+1}</span>{s.name}<small>{i===selected?'正在展开':'查看设计'}</small></button>)}</nav>
 <div className="agenda-story" key={selected}><div className="agenda-question"><span className="eyebrow">下一步可以做的研究</span><h2>{study.question}</h2><p>{study.sample}</p><div className="agenda-route">{study.route.split(' → ').map((part,i)=><span key={part}>{i>0&&<b aria-hidden>→</b>}{part}</span>)}</div></div>
 <div className="agenda-design"><div className="agenda-contrast"><span>保持输入一致，比较两种处理</span>{study.contrast.map((c,i)=><div key={c}><i>{i===0?'A':'B'}</i><strong>{c}</strong></div>)}</div><div className="agenda-metrics"><span>记录什么</span>{study.metrics.map((m,i)=><p key={m}><b>0{i+1}</b>{m}</p>)}</div></div></div>
 <div className="agenda-takeaway"><p>{study.decision}</p><button onClick={onInspect}>查看本次记录 <b>{records.length}</b> ↗</button></div><p className="agenda-note">以上为待验证的研究设计。今天的小镇是机制演示，已有的三组种子不能代替数据校准和统计验证。</p></section>
}
