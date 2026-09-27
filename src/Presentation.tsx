import {useCallback,useEffect,useRef,useState} from 'react';
import {story,resources,readLocation} from './deck/story';
import {BookIntro,Comparison,Judgment,PrimitivesOverview,Training} from './deck/Scenes';
import {Example} from './deck/Examples';
import {VoiceLab} from './features/alignment/VoiceLab';
import {EconomyLab} from './features/abm/EconomyLab';
import {Uncertainty,Workflow} from './components/Concepts';
import {TextLab} from './features/text/TextLab';
import type {RecordEvent} from './shared/types';
import './deck/deck.css';

type Panel='contents'|'notes'|'sources'|'records'|'appendix'|null;
const pad=(n:number)=>String(n).padStart(2,'0');
export function App(){
 const [position,setPosition]=useState(()=>readLocation(location.hash));
 const {index,beat}=position,scene=story[index];
 const [panel,setPanel]=useState<Panel>(null),[appendix,setAppendix]=useState(0),[records,setRecords]=useState<RecordEvent[]>([]),[notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 const onRecord=useCallback((event:RecordEvent)=>setRecords(previous=>[event,...previous].slice(0,500)),[]);
 const onQuota=useCallback((message:string)=>setNotice(message),[]);
 const go=useCallback((next:number,step=0)=>{
  const i=Math.max(0,Math.min(story.length-1,next)),b=Math.max(0,Math.min(story[i].beats.length-1,step));
  history.pushState(null,'',`#${story[i].id}${b?`/${b}`:''}`);setPosition({index:i,beat:b});setPanel(null);
 },[]);
 const move=useCallback((direction:number)=>{
  if(direction>0){if(beat<scene.beats.length-1)go(index,beat+1);else if(index<story.length-1)go(index+1)}
  else if(beat>0)go(index,beat-1);else if(index>0)go(index-1,story[index-1].beats.length-1);
 },[beat,index,scene,go]);
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setNotice('也可以按浏览器的 F11 进入全屏。')}}
 useEffect(()=>{const handler=()=>setPosition(readLocation(location.hash));window.addEventListener('popstate',handler);window.addEventListener('hashchange',handler);return()=>{window.removeEventListener('popstate',handler);window.removeEventListener('hashchange',handler)}},[]);
 useEffect(()=>{document.title=`${scene.title} · Jev`;},[scene]);
 useEffect(()=>{window.scrollTo(0,0)},[index]);
 useEffect(()=>{const element=dialog.current;if(!element)return;if(panel){if(!element.open)element.showModal();element.scrollTop=0;element.querySelector<HTMLButtonElement>('.dialog-close')?.focus()}else element.close()},[panel]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{
  if(panel||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
  const detail=document.querySelector<HTMLDetailsElement>('.voice-lab details[open]');
  if(detail){
   if(event.key==='Escape'){event.preventDefault();detail.open=false;detail.querySelector('summary')?.focus()}
   if(event.key==='Tab'){const controls=Array.from(detail.querySelectorAll<HTMLElement>('summary,button:not(:disabled),textarea,input,select,a[href]')).filter(e=>e.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
   return;
  }
  if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.repeat)return;
  if(['ArrowRight','PageDown'].includes(event.key)||(event.key===' '&&!(event.target as HTMLElement).closest('button,a,summary'))){event.preventDefault();move(1)}
  else if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();move(-1)}
  else if(event.key==='Home'){event.preventDefault();go(0)}
  else if(event.key==='Escape')setPanel('contents');
  else if(event.key.toLowerCase()==='f'){event.preventDefault();void fullscreen()}
  else if(event.key.toLowerCase()==='n')setPanel('notes');
 };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[panel,move,go]);
 const props={onRecord,onQuota};
 const dark=['comparison','training'].includes(scene.id);
 return <div className={`deck ${dark?'deck-dark':''} deck-${scene.id}`}>
  <header className="deck-header"><button className="deck-wordmark" onClick={()=>go(0)} aria-label="返回开场">Jev<span>•</span></button><span className="deck-header-label">一种面向软件的决策模型</span><nav><button onClick={()=>setPanel('notes')}>讲者笔记</button><button onClick={()=>void fullscreen()} aria-label="切换全屏">全屏 <span>⛶</span></button><button onClick={()=>setPanel('contents')}>目录 <span>☰</span></button></nav></header>
  {notice&&<div className="deck-notice" role="alert"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="关闭提示">×</button></div>}
  <main className="deck-main" data-scene={scene.id} data-beat={beat}>
   {index!==0&&<div className="deck-title" key={scene.id}><div><span className="overline">{scene.section}</span><h1>{scene.title}</h1></div><p>{scene.subtitle}</p></div>}
   <div className={`deck-stage scene-${scene.id}`}>
    {index<2?<BookIntro opening={index===0} beat={beat} onNext={()=>move(1)}/>:<div className="scene-mount" key={scene.id}>
     {scene.id==='judgment'&&<Judgment beat={beat}/>}
     {scene.id==='comparison'&&<Comparison beat={beat}/>}
     {scene.id==='training'&&<Training beat={beat}/>}
     {scene.id==='primitives'&&<PrimitivesOverview beat={beat} onSelect={step=>go(index,step)}/>}
     {(['choice','noul','score'] as string[]).includes(scene.id)&&<Example kind={scene.id as 'choice'|'noul'|'score'} beat={beat} setBeat={step=>go(index,step)} {...props}/>}
     {scene.id==='voice'&&<><div className="voice-flow"><span>声音</span><i>→</i><span>ASR 转写</span><i>→</i><span>对齐 ＋ Jev 判断</span><i>→</i><span>稿件位置</span></div><VoiceLab {...props}/></>}
     {scene.id.startsWith('economy')&&<div className="town-scroll"><EconomyLab {...props}/></div>}
    </div>}
   </div>
  </main>
  <footer className="deck-footer"><button className="deck-reference" onClick={()=>setPanel('sources')}>资料 <span>↗</span></button><div className="deck-beat-progress" aria-label="本页讲解步骤">{scene.beats.map((label,i)=><button key={label} onClick={()=>go(index,i)} aria-label={label} aria-current={i===beat?'step':undefined} className={i<=beat?'done':''}/>)}</div><p className="deck-cue" aria-live="polite">{scene.beats[beat]}</p><div className="deck-navigation"><span>{pad(index+1)} <i>/ {pad(story.length)}</i></span><button aria-label="上一步" disabled={index===0&&beat===0} onClick={()=>move(-1)}>←</button><button className="next-step" aria-label="下一步" disabled={index===story.length-1&&beat===scene.beats.length-1} onClick={()=>move(1)}>→</button></div></footer>
  <div className="deck-total-progress" style={{width:`${(index+(beat+1)/scene.beats.length)/story.length*100}%`}}/>
  <dialog ref={dialog} aria-label="演示资料与导航" className={`deck-dialog ${panel==='appendix'?'wide-dialog':''}`} onCancel={()=>setPanel(null)} onClick={event=>{if(event.target===event.currentTarget)setPanel(null)}}><div className="dialog-inner"><button className="dialog-close" aria-label="关闭面板" onClick={()=>setPanel(null)}>×</button>
   {panel==='contents'&&<><span className="overline">这次我们讲什么</span><h2>从一个判断，到一个应用。</h2><div className="deck-contents">{story.map((item,i)=><button key={item.id} onClick={()=>go(i)} className={i===index?'current':''}><span>{pad(i+1)}</span><strong>{item.title}</strong><b>↗</b></button>)}</div><div className="dialog-bottom"><span>← → / 空格推进 · F 全屏 · N 笔记</span><button onClick={()=>setPanel('appendix')}>备用内容 ↗</button></div></>}
   {panel==='notes'&&<><span className="overline">讲者笔记 · {pad(index+1)}</span><h2>{scene.title}</h2><p className="speaker-notes">{scene.note}</p><ol className="notes-beats">{scene.beats.map((text,i)=><li className={i===beat?'current':''} key={text}>{text}</li>)}</ol></>}
   {panel==='sources'&&<><span className="overline">资料与说明</span><h2>进一步了解 Jev。</h2><div className="deck-sources">{resources.map(([label,url])=><a href={url} target="_blank" rel="noreferrer" key={url}>{label}<span>↗</span></a>)}</div><p>书本画面是为本次讲解制作的概念导读。原理图与默认案例使用示意数据；点击“用 Jev 判断”后，画面显示本次真实返回。</p><p>System 1 是命名来源的类比。模型概率需要通过实际任务评估，不能把单次概率当作准确率。</p><div className="dialog-bottom"><button onClick={()=>setPanel('appendix')}>备用内容 ↗</button><button onClick={()=>setPanel('records')}>本次运行记录 ↗</button></div></>}
   {panel==='records'&&<><span className="overline">本次运行</span><h2>{records.length} 条记录</h2><button className="deck-primary" disabled={!records.length} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(records,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jev-run-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>导出记录 ↓</button>{records.map(r=><details key={r.id}><summary>{r.label} · {r.source}</summary><pre>{JSON.stringify(r,null,2)}</pre></details>)}</>}
   {panel==='appendix'&&<><span className="overline">备用内容</span><h2>需要时，再展开一步。</h2><div className="appendix-tabs">{['分数与分布','判断与执行','政策文本分析'].map((label,i)=><button aria-pressed={appendix===i} onClick={()=>setAppendix(i)} key={label}>{label}</button>)}</div><div className="appendix-body">{appendix===0?<Uncertainty/>:appendix===1?<Workflow/>:<TextLab {...props}/>}</div></>}
  </div></dialog>
 </div>
}
