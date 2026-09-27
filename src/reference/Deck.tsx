import {useCallback,useEffect,useRef,useState} from 'react';
import {story,readLocation,resources} from '../deck/story';
import {EconomyLab} from '../features/abm/EconomyLab';
import type {RecordEvent} from '../shared/types';
import {Judgment} from './Lessons';
import {BookPages} from './BookPages';
import {Comparison,Primitives,Training} from './ConceptPages';
import {ApplicationPage} from './ApplicationPages';
import {VoicePage} from './VoicePage';
import {AbmChapter} from './AbmChapter';
import {useAbmData} from './use-abm-data';
import {MotionInspector} from './MotionInspector';
import {ComparisonOverlay} from './ComparisonOverlay';
import './reference.css';

const referenceIds=['01-opening','02-system-one','03-judgment','04-comparison','05-training','06-primitives','07-choice','08-noul','09-score','10-voice','11-economy','12-economy-person','13-economy-round','14-economy-compare'];
type Panel='contents'|'notes'|'sources'|'records'|'experiment'|null;
export function ReferencePresentation(){
 const [size,setSize]=useState({width:innerWidth,height:innerHeight}),[position,setPosition]=useState(()=>readLocation(location.hash)),[guide,setGuide]=useState(0),[panel,setPanel]=useState<Panel>(null),[notice,setNotice]=useState(''),[records,setRecords]=useState<RecordEvent[]>([]);
 const {index,beat}=position,scene=story[index],dialog=useRef<HTMLDialogElement>(null),comparisonOpen=index===3&&beat===3;
 const [primitiveReplay,setPrimitiveReplay]=useState(0);
 const [abmResident,setAbmResident]=useState('R05'),[abmRound,setAbmRound]=useState(1);
 const abm=useAbmData(index>=9);
 const onRecord=useCallback((event:RecordEvent)=>setRecords(old=>[event,...old].slice(0,500)),[]);
 const go=useCallback((i:number,b=0)=>{i=Math.min(story.length-1,Math.max(0,i));b=Math.min(story[i].beats.length-1,Math.max(0,b));history.pushState(null,'',`#${story[i].id}${b?`/${b}`:''}`);setPosition({index:i,beat:b});setPanel(null);setGuide(0)},[]);
 const move=useCallback((dir:number)=>{if(dir>0){if(beat<scene.beats.length-1)go(index,beat+1);else if(index<story.length-1)go(index+1)}else if(beat>0)go(index,beat-1);else if(index>0)go(index-1,story[index-1].beats.length-1)},[index,beat,scene,go]);
 const fullscreen=useCallback(async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setNotice('请按浏览器 F11 进入全屏。')}},[]);
 useEffect(()=>{const resize=()=>setSize({width:innerWidth,height:innerHeight}),hash=()=>setPosition(readLocation(location.hash));window.addEventListener('resize',resize);window.addEventListener('popstate',hash);window.addEventListener('hashchange',hash);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('popstate',hash);window.removeEventListener('hashchange',hash)}},[]);
 useEffect(()=>{document.title=`${scene.title} · Jev`;},[scene]);
 useEffect(()=>{if(panel)dialog.current?.showModal();else dialog.current?.close()},[panel]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(panel||e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;const target=e.target as HTMLElement;
  const comparisonDialog=document.querySelector<HTMLElement>('.comparison-overlay[data-open="true"] [role="dialog"]');
  if(comparisonDialog){
   if(e.key==='Escape'){e.preventDefault();go(3,2);return}
   if(e.key==='Tab'){const controls=Array.from(comparisonDialog.querySelectorAll<HTMLElement>('button,a[href]'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===comparisonDialog)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}return}
  }
  const voiceDetail=document.querySelector<HTMLElement>('.r-voice-details');
  if(voiceDetail){if(e.key==='Escape'){e.preventDefault();voiceDetail.querySelector<HTMLButtonElement>('.r-close')?.click();document.querySelector<HTMLButtonElement>('.r-voice-details-toggle')?.focus()}else if(e.key==='Tab'){const controls=Array.from(voiceDetail.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input,select'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}return}
  const liveDetail=document.querySelector<HTMLDetailsElement>('.r-live-control[open]');if(e.key==='Escape'&&liveDetail){e.preventDefault();liveDetail.open=false;liveDetail.querySelector('summary')?.focus();return}
  if(target.closest('input,textarea,select,[contenteditable="true"],details[open],.r-voice-details'))return;
  if(e.key==='ArrowRight'||e.key==='PageDown'||(e.key===' '&&!target.closest('button,a,summary'))){e.preventDefault();move(1)}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();move(-1)}
  else if(e.key==='Home'){e.preventDefault();go(0)}else if(e.key==='Escape')setPanel('contents');
  else if(e.key.toLowerCase()==='f')void fullscreen();else if(e.key.toLowerCase()==='n')setPanel('notes');else if(e.key.toLowerCase()==='o')setGuide(x=>(x+1)%3);
 };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[panel,move,go,fullscreen]);
 const scale=Math.min(size.width/1672,size.height/941),props={onRecord,onQuota:setNotice};
 const reference=index===1&&beat>=2?'02b-book-focus':comparisonOpen?'04-comparison-cost':referenceIds[index];
 return <div className="reference-viewport"><main className={`reference-canvas r-scene-${scene.id}`} data-scene={scene.id} data-beat={beat} style={{transform:`scale(${scale})`,left:(size.width-1672*scale)/2,top:(size.height-941*scale)/2}}>
  <header className="r-header" inert={comparisonOpen}><button className="r-wordmark" onClick={()=>go(0)} aria-label="返回开场">Jev<span>•</span></button><button className="r-menu" onClick={()=>setPanel('contents')}>目录 <i/></button></header>
  {index<2?<BookPages opening={index===0} beat={beat} onNext={()=>move(1)}/>:<div className="r-page-mount" key={index===5?`${scene.id}-${primitiveReplay}`:scene.id} inert={comparisonOpen}>
   {index===2&&<Judgment beat={beat}/>}{index===3&&<Comparison beat={beat}/>}{index===4&&<Training beat={beat}/>}{index===5&&<Primitives beat={beat}/>}
   {index>=6&&index<=8&&<ApplicationPage kind={scene.id as 'choice'|'noul'|'score'} beat={beat} setBeat={b=>go(index,b)} {...props}/>}
   {index===9&&<VoicePage {...props}/>}
  </div>}
  {index>=10&&<AbmChapter page={index-10} beat={beat} active={!panel} data={abm.data??null} error={abm.error} retry={abm.retry} selected={abmResident} onSelect={setAbmResident} round={abmRound} setRound={setAbmRound} go={go} experiment={()=>setPanel('experiment')}/>}
  <footer className="r-footer" inert={comparisonOpen}><button aria-label="上一步" disabled={index===0} onClick={()=>move(-1)}>←</button><button className="r-page-counter" title="点击重播本页" aria-label="重播本页" onClick={()=>{if(index===5)setPrimitiveReplay(x=>x+1);if(index===12)setAbmRound(1);go(index,0)}}>{String(index+1).padStart(2,'0')} / {story.length}</button><button aria-label="下一步" disabled={index===story.length-1&&beat===scene.beats.length-1} onClick={()=>move(1)}>→</button></footer>
  <ComparisonOverlay open={comparisonOpen} onClose={()=>go(3,2)} onNext={()=>go(4)}/>
  {notice&&<div className="r-notice" role="alert">{notice}<button aria-label="关闭提示" onClick={()=>setNotice('')}>×</button></div>}
  {guide>0&&<><img className={`r-reference-overlay ${guide===2?'reference-only':''}`} src={`/reference-art/ref-${reference}.png`} alt="参考图对照"/><span className="r-guide-label">{guide===1?'叠图对照':'原参考图'} · O 切换</span></>}
 </main>
 <dialog ref={dialog} className={`r-dialog ${panel==='experiment'?'abm-experiment-dialog':''}`} aria-label="演示导航与资料" onCancel={()=>setPanel(null)} onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}><button className="r-close" aria-label="关闭面板" onClick={()=>setPanel(null)}>×</button>
  {panel==='experiment'&&<><h2>小镇实验台</h2><EconomyLab {...props}/></>}
  {panel==='contents'&&<><h2>从一个判断，到一个应用。</h2><div className="r-contents">{story.map((s,i)=><button key={s.id} onClick={()=>go(i)} aria-current={i===index?'page':undefined}><span>{String(i+1).padStart(2,'0')}</span>{s.title}</button>)}</div><div className="r-panel-actions"><button onClick={()=>void fullscreen()}>全屏 ⛶</button><button onClick={()=>setPanel('notes')}>讲者笔记</button><button onClick={()=>setPanel('sources')}>资料</button><button onClick={()=>setPanel('records')}>运行记录</button><button onClick={()=>{setPanel(null);setGuide(1)}}>对照参考图</button></div><p className="r-key-help">← → / 空格推进 · F 全屏 · N 笔记 · O 对照 · 页码重播</p></>}
  {panel==='notes'&&<><h2>{scene.title}</h2><p style={scene.id==='opening'?{whiteSpace:'pre-line'}:undefined}>{scene.note}</p><ol>{scene.beats.map((s,i)=><li key={s} className={i===beat?'current':''}>{s}</li>)}</ol></>}
  {panel==='sources'&&<><h2>进一步了解 Jev</h2>{resources.map(([label,url])=><p key={url}><a href={url} target="_blank" rel="noreferrer">{label} ↗</a></p>)}<p>System 1 是命名来源的类比。默认图示使用预设值；“现场判断”会显示本次模型返回。概率校准需要在一组任务上评估。</p><a href="/?legacy#opening">打开保留的旧版实验与备用内容 ↗</a></>}
  {panel==='records'&&<><h2>本次运行 · {records.length} 条</h2><button disabled={!records.length} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(records,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jev-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>导出记录</button>{records.map(r=><details key={r.id}><summary>{r.label} · {r.source}</summary><pre>{JSON.stringify(r,null,2)}</pre></details>)}</>}
 </dialog>{new URLSearchParams(location.search).has('motion-qa')&&<MotionInspector next={()=>move(1)} previous={()=>move(-1)}/>}</div>
}
