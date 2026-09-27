import {useEffect,useState} from 'react';
import {BookFilm} from './BookFilm';
import {FlowArrow,Glyph,JevMark,Reveal,motionStyle} from './Geometry';

export function BookIntro({opening,beat,onNext}:{opening:boolean;beat:number;onNext:()=>void}){
 const expanded=!opening&&beat>0;
 return <div className={`book-intro ${opening?'is-cover':'is-system'} ${expanded?'book-expanded':''}`}>
  <div className="cover-copy" aria-hidden={!opening} inert={!opening}><span className="overline">JEV · SYSTEM ONE</span><h1>让软件，<br/>也能做<span>判断。</span></h1><p>认识 Jev，<br/>一种面向软件的决策模型。</p><button className="deck-primary" onClick={onNext}>从一个直观开始 <span>↗</span></button><div className="cover-index"><span>直观</span><i/><span>原理</span><i/><span>应用</span></div></div>
  <div className="book-film" aria-hidden={expanded}><div className="book-camera"><BookFilm open={!opening} visible={!expanded}/></div><div className="book-credit">Daniel Kahneman <span>《思考，快与慢》</span></div></div>
  {!opening&&<div aria-hidden={!expanded} inert={!expanded} className={`intuition-board ${expanded?'visible':''}`}>
   <section className="intuition-fast"><div className="small-label">SYSTEM 1 <span>快速、直观</span></div><div className="coffee-scene"><svg viewBox="0 0 200 200" fill="none" aria-hidden="true"><ellipse cx="95" cy="171" rx="65" ry="9" fill="#1d504b" opacity=".08"/><path d="M55 60H132L122 157H65Z" fill="#dce8df" stroke="#1d504b" strokeWidth="2"/><path d="M132 79H147C177 79 176 124 127 125" stroke="#1d504b" strokeWidth="3"/><path d="M46 56H140V66H46Z" fill="#1d504b"/><path className="steam" d="M81 39C65 19 101 24 87 5M108 37C97 21 122 18 114 2" stroke="#1d504b" strokeWidth="2"/><path d="M61 98H128L124 131H64Z" fill="#1d504b"/><text x="94" y="120" textAnchor="middle" fontSize="17" fill="#fff">COFFEE</text></svg><div className="price-label"><s>¥ 12</s><strong>¥ 18</strong></div></div><h2>“怎么涨了这么多？”</h2><p>一个熟悉的价格，触发了直观反应。</p></section>
   <Reveal show={beat>=2} className="intuition-slow"><div className="small-label">SYSTEM 2 <span>比较、计算</span></div><div className="budget-sheet"><span>这个月的预算</span>{[['餐饮','900'],['交通','200'],['其他','300']].map(([a,b],i)=><div key={a} style={motionStyle(i*170)}><span>{a}</span><strong>¥ {b}</strong></div>)}<div className="budget-total"><span>计划支出</span><strong>¥ 1,400</strong></div></div><h2>“这个月，要花多少钱？”</h2><p>把几个条件放在一起，再做决定。</p></Reveal>
   <Reveal show={beat>=3} className="intuition-conclusion"><JevMark/><p>Jev 借用 <strong>System One</strong> 的名字，<br/>强调快速、聚焦的判断。</p></Reveal>
  </div>}
 </div>;
}

export function Judgment({beat}:{beat:number}){return <div className={`judgment-scene beat-${beat}`}>
 <div className="judgment-track"><div className="input-document"><span className="small-label">01 · 当前情况</span><span className="message-avatar">同学</span><p>我已经付款了，<br/>订单还显示<span className="text-accent">未支付</span>。</p><div className="document-lines"><i/><i/></div></div><FlowArrow active={beat>=1}/><Reveal show={beat>=1} className="question-card"><div className="model-symbol"><JevMark/></div><span className="small-label">02 · 明确问题</span><h2>这条消息<br/>该交给谁？</h2><div className="answer-options"><span>订单服务</span><span>商品咨询</span><span>其他</span></div></Reveal><FlowArrow active={beat>=2}/><Reveal show={beat>=2} className="answer-card" delay={200}><span className="small-label">03 · 返回判断</span><div className="answer-check">↗</div><h2>订单服务</h2><p>程序接收结果，<br/>安排下一步。</p><span className="example-label">流程示意</span></Reveal></div>
 <div className="scene-bottom-line"><span>上下文</span><i/><span>问题与答案范围</span><i/><span>可使用的结果</span></div>
 </div>}

export function Comparison({beat}:{beat:number}){
 const [tokens,setTokens]=useState(0);
 useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){setTokens(8);return}setTokens(0);let n=0;const timer=setInterval(()=>{n++;setTokens(n);if(n===8)clearInterval(timer)},310);return()=>clearInterval(timer)},[]);
 const words=['这条','消息','涉及','付款','状态','，请','联系','订单服务。'];
 return <div className={`comparison-scene beat-${beat}`}>
 <div className="shared-input"><span>同一条消息</span><p>我已经付款了，订单还显示未支付。</p></div>
 <div className="compare-columns"><section className="generation-pane"><div className="pane-label"><span className="number-tag">A</span><h2>生成回答</h2><span>常见自回归语言模型</span></div><div className="token-row">{words.map((word,i)=><span key={i} className={i<tokens?'token visible':'token'} style={motionStyle(i*30)}>{word}</span>)}</div><svg className="autoregressive-loop" viewBox="0 0 540 115" fill="none" aria-hidden="true"><path className="loop-track" d="M475 15V56Q475 76 450 76H90Q65 76 65 56V15"/><path d="M55 28L65 15L75 28"/><circle className="loop-particle" r="5" fill="currentColor"><animateMotion dur="2.8s" repeatCount="2" path="M475 15V56Q475 76 450 76H90Q65 76 65 56V15"/></circle><text x="270" y="61" textAnchor="middle">已有内容 → 下一个 token</text></svg><p className="pane-conclusion">一步一步，接着写下去。</p></section>
 <section className={`decision-pane ${beat>=1?'on':''}`}><div className="pane-label"><span className="number-tag">B</span><h2>返回判断</h2><span>Jev</span></div><div className="decision-question">这条消息该交给谁？</div><div className="decision-distribution">{[['订单服务',.91],['商品咨询',.06],['其他',.03]].map(([label,value],i)=><div key={label} className={i===0?'selected':''}><span>{label}</span><div className="decision-bar"><i style={{width:beat>=1?`${Number(value)*100}%`:'0%',transitionDelay:`${i*100}ms`}}/></div><b>{beat>=1?`${Number(value)*100}%`:'—'}</b></div>)}</div><div className={`output-contract ${beat>=2?'on':''}`}><span>交给程序</span><strong>订单服务 <i>↗</i></strong></div><span className="example-label">示意输出</span></section></div>
 </div>
}

export function Training({beat}:{beat:number}){return <div className={`training-scene beat-${beat}`}>
 <div className="training-origin"><JevMark/><span>从已有的语言理解能力出发</span></div>
 <svg className="training-fork" viewBox="0 0 1000 64" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M500 0V18Q500 34 480 34H250Q235 34 235 48V64M500 18Q500 34 520 34H750Q765 34 765 48V64"/></svg>
 <div className="training-columns"><section className="preference-track"><span className="small-label">RLHF</span><h2>人更偏好怎样的回答？</h2><div className="preference-options"><div><span>A</span><p>请联系订单服务。</p></div><div className="preferred"><span>B</span><p>可以联系订单服务，<br/>并提供付款记录。</p><b>✓</b></div></div><div className="training-return"><span>人类偏好</span><svg viewBox="0 0 200 40" fill="none" aria-hidden="true"><path pathLength="1" d="M195 5V22H5V5M0 11L5 5L10 11"/></svg><span>反馈用于训练</span></div></section>
 <section className={`calibration-track ${beat>=1?'on':''}`}><span className="small-label">RLCD</span><h2>判断的概率，与结果相符吗？</h2><div className="calibration-main"><div className="probability-number"><strong>80<span>%</span></strong><p>一组预测给出的概率</p></div><div className={`outcome-dots ${beat>=2?'resolved':''}`}>{Array.from({length:10},(_,i)=><span className={i<8?'yes':'no'} key={i} style={motionStyle(i*65)}>{beat>=2?(i<8?'✓':'−'):'?'}</span>)}</div></div><div className="calibration-caption">{beat>=2?<>理想校准下，约 <strong>80%</strong> 的事件实际发生</>:'收集后续结果，再看它们是否相符'}</div><span className="example-label">校准示意</span></section></div>
 </div>}

export function PrimitivesOverview({beat,onSelect}:{beat:number;onSelect:(n:number)=>void}){const items=[['choice','Choice','选哪个？','从预先给定的选项里选择'],['noul','Noul','是否成立？','用概率表达一个条件的判断'],['score','Score','程度多高？','按定义好的等级给出分数']] as const;
 return <div className="types-scene">{items.map(([kind,title,question,desc],i)=><button className={`type-column ${beat===i?'focused':''} ${beat>i?'visited':''} tone-${kind}`} key={kind} aria-pressed={beat===i} onClick={()=>onSelect(i)}><span className="type-number">0{i+1}</span><h2>{question}</h2><Glyph kind={kind} active={beat>=i}/><div className="type-name">{title}</div><p>{desc}</p><span className="type-foot">{['候选项 → 一个选择','明确条件 → 0 到 1 的概率','有序等级 → 一个分数'][i]}</span></button>)}</div>}
