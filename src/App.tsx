import {Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {chapters,sources} from './content';
import {Primitives,Uncertainty,Workflow} from './components/Concepts';
import {BookFlipbook} from './components/BookFlipbook';
import type {BookKey} from './components/flipbook';
import {ResearchAgenda} from './components/ResearchAgenda';
import {VoiceLab} from './features/alignment/VoiceLab';
import {TextLab} from './features/text/TextLab';
import {EconomyLab} from './features/abm/EconomyLab';
import type {RecordEvent} from './shared/types';

type Drawer='contents'|'notes'|'sources'|'records'|null;
/** Where the book should come to rest, and whether to cut straight to it instead of flipping. */
type Book={target:BookKey;instant:boolean};
const two=(n:number)=>String(n).padStart(2,'0');
const shortcuts:[number,string][]=[[2,'模型机制'],[5,'现场跟读'],[7,'政策与 ABM']];
function initial(){const raw=location.hash.slice(1),p=['round','compare'].includes(raw)?'economy':raw;return Math.max(0,chapters.findIndex(x=>x.id===p))}
/** The book as a scene shows it when reached by a cut (reload, browser history). */
const cutTo=(next:number,from:number):Book=>({target:next===0?'closed':from===2&&next===1?'entered':'open',instant:true});

export function App(){
 const [index,setIndex]=useState(initial),[drawer,setDrawer]=useState<Drawer>(null),[records,setRecords]=useState<RecordEvent[]>([]),[quota,setQuota]=useState('');
 const [book,setBook]=useState<Book>(()=>cutTo(initial(),-1)),[bookAt,setBookAt]=useState<BookKey|null>(null);
 const shown=useRef(index);shown.current=index;
 const chapter=chapters[index];const onRecord=useCallback((event:RecordEvent)=>setRecords(prev=>[event,...prev].slice(0,500)),[]);const onQuota=useCallback((message:string)=>setQuota(message),[]);
 function navigate(next:number){const hash=`#${chapters[next].id}`;if(location.hash!==hash)history.pushState(null,'',hash);setIndex(next);setDrawer(null)}
 /** Jump to a scene. Scenes are hard cuts; only the book, shared by the first two scenes, is animated. */
 function go(i:number){
  const next=Math.max(0,Math.min(chapters.length-1,i));setDrawer(null);if(next===index)return;
  if(next===0)setBook({target:'closed',instant:index!==1});
  else if(next===1)setBook(index===2?{target:'entered',instant:true}:{target:'open',instant:index!==0});
  navigate(next);
 }
 /** Step forward or back. In scene 2 the first step turns the book to (or back from) its diagram page. */
 function step(delta:1|-1){
  if(index===1&&delta===1&&book.target!=='entered'){setBook({target:'entered',instant:false});setDrawer(null);return}
  if(index===1&&delta===-1&&book.target==='entered'){setBook({target:'open',instant:false});setDrawer(null);return}
  go(index+delta);
 }
 useEffect(()=>{document.title=`${chapter.title} · Jev`;window.scrollTo(0,0);},[chapter.id]);
 useEffect(()=>{if(['#round','#compare'].includes(location.hash))history.replaceState(null,'','#economy');if(!chapters.some(c=>location.hash===`#${c.id}`))history.replaceState(null,'',`#${chapters[0].id}`);const fn=()=>{if(['#round','#compare'].includes(location.hash))history.replaceState(null,'','#economy');const next=initial();if(next<2)setBook(cutTo(next,shown.current));setIndex(next);setDrawer(null)};window.addEventListener('hashchange',fn);window.addEventListener('popstate',fn);return()=>{window.removeEventListener('hashchange',fn);window.removeEventListener('popstate',fn)}},[]);
 useEffect(()=>{if(!drawer)return;const previous=document.activeElement as HTMLElement|null;const panel=document.querySelector<HTMLElement>('.drawer');panel?.querySelector<HTMLElement>('button')?.focus();const trap=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDrawer(null);return}if(e.key!=='Tab'||!panel)return;const nodes=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,select,summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last?.focus()}else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first?.focus()}};document.addEventListener('keydown',trap,true);const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',trap,true);document.body.style.overflow=before;previous?.focus()}},[!!drawer]);
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='Escape'){setDrawer(prev=>prev?null:'contents');return}if(drawer)return;if(e.key==='ArrowRight'||e.key==='PageDown'||(e.key===' '&&!(e.target as HTMLElement).closest('button,a'))){e.preventDefault();step(1)}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();step(-1)}if(e.key.toLowerCase()==='f'){if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen()}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[index,drawer,book]);
 const props={onRecord,onQuota};
 const arrived=book.target==='entered'&&bookAt==='entered';
 const cue=book.target!=='entered'?'进入书页中的图解 →':arrived?'继续：三个可编程的问题 →':'进入图解中… 点击继续 →';
 return <div className="experience"><header className="site-header"><button className="wordmark" onClick={()=>go(0)} aria-label="返回开场">Jev<span>·</span></button><span className="header-caption">STRUCTURED JUDGMENT / 研究展示</span><nav><button onClick={()=>setDrawer('notes')}>讲者笔记</button><button onClick={()=>setDrawer('contents')}>目录 <span aria-hidden>☰</span></button></nav></header>{quota&&<div className="quota-banner" role="alert">{quota} · 相关调用已暂停。</div>}
 <main className={`main-stage scene-${chapter.id}`}>
 <div className="book-scene" hidden={index>1}>
  {index===0&&<div className="book-copy hero-copy" key="opening"><p className="eyebrow">JEV / SYSTEM ONE</p><h1><em>Jev</em> 的<br/><span className="ink-underline">结构化判断</span><span>。</span></h1><p className="hero-subtitle">{chapter.subtitle}</p><p className="hero-body">{chapter.body}</p><button className="primary hero-cta" onClick={()=>go(1)}>翻开这一页 <span>↗</span></button><div className="hero-chapters">{shortcuts.map(([i,label])=><button key={i} onClick={()=>go(i)}><b>{two(i+1)}</b>{label}</button>)}</div></div>}
  {index===1&&<div className="book-copy" key="system-one"><div className="chapter-number"><b>{two(index+1)}</b><span>{chapter.section}</span></div><h1>{chapter.title}</h1><p className="chapter-subtitle">{chapter.subtitle}</p><p className="chapter-body">{chapter.body}</p></div>}
  <figure className="book-stage"><div className="book-mount sheet"><BookFlipbook target={book.target} instant={book.instant} onArrive={setBookAt}/><i className="tape" aria-hidden/><i className="tape blue" aria-hidden/></div>
   <figcaption><small className="book-note">原创导读，非原书内页复刻</small>{index===1&&<button className={`text-button book-cue${arrived?' arrived':''}`} onClick={()=>step(1)}>{cue}</button>}</figcaption>
   <span className="vertical-note" aria-hidden>THINKING, FAST AND SLOW</span></figure>
 </div>
 {index>1&&<><section className="chapter-intro" key={chapter.id}><div className="chapter-number"><b>{two(index+1)}</b><span>{chapter.section}</span></div><h1>{chapter.title}</h1><p className="chapter-subtitle">{chapter.subtitle}</p><p className="chapter-body">{chapter.body}</p></section>
 <section className="chapter-workspace" key={`${chapter.id}-workspace`}><Suspense fallback={<div className="loading">正在准备实验界面…</div>}>
 {index===2&&<Primitives {...props}/>}{index===3&&<Uncertainty/>}{index===4&&<Workflow/>}{index===5&&<VoiceLab {...props}/>}{index===6&&<TextLab {...props}/>}{chapter.id==='economy'&&<EconomyLab {...props}/>}
 {chapter.id==='discussion'&&<ResearchAgenda records={records} onInspect={()=>setDrawer('records')}/>}
 </Suspense></section></>}
 </main><footer className="site-footer"><button className="footer-sources" onClick={()=>setDrawer('sources')}>资料与方法 <span>↗</span></button><div className="progress-dots" aria-label="章节进度">{chapters.map((c,i)=><button key={c.id} className={i===index?'active':''} onClick={()=>go(i)} aria-label={c.title} title={c.title} aria-current={i===index?'step':undefined}/>)}</div><div className="page-navigation"><span>{two(index+1)} <i>/ {chapters.length}</i></span><button aria-label="上一幕" disabled={index===0} onClick={()=>step(-1)}>←</button><button aria-label="下一幕" disabled={index===chapters.length-1} onClick={()=>step(1)}>→</button></div></footer>
 {drawer&&<div className="drawer-backdrop" onClick={()=>setDrawer(null)}><section className="drawer" role="dialog" aria-modal="true" aria-label="展示详情" onClick={e=>e.stopPropagation()}><button className="close-drawer" aria-label="关闭" onClick={()=>setDrawer(null)}>×</button><div className="drawer-body">{drawer==='contents'?<><p className="eyebrow">CONTENTS</p><h2>浏览这次研究</h2><div className="contents-list">{chapters.map((c,i)=><button className={index===i?'active':''} key={c.id} onClick={()=>go(i)}><span>{two(i+1)}</span>{c.title}<b>↗</b></button>)}</div></>:drawer==='notes'?<><p className="eyebrow">PRESENTER NOTES</p><h2>{chapter.title}</h2><p>{chapter.note}</p><p className="drawer-help">方向键切换场景 · F 全屏 · Esc 目录<br/>输入框内保留正常文字操作。</p></>:drawer==='sources'?<><p className="eyebrow">SOURCES & METHOD</p><h2>资料与方法</h2><p>模型定位依据官方文档。文化消费券、居民与商家为虚构研究情景；真实调用、规则运行与回放分别标记。</p><div className="sources-list">{sources.map(([label,url])=><a href={url} target="_blank" rel="noreferrer" key={url}>{label}<span>↗</span></a>)}</div><button className="secondary" onClick={()=>setDrawer('records')}>检查运行记录</button></>:<><p className="eyebrow">RUN RECORDS</p><h2>本次运行记录</h2><p className="small">共 {records.length} 条 · 包含输入与输出，不包含服务凭据</p><button className="secondary" disabled={!records.length} onClick={()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(records,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='jev-run-records.json';a.click();URL.revokeObjectURL(u)}}>导出记录 ↓</button>{records.length?records.map(r=><details key={r.id}><summary>{r.label} <span>{r.source} · {new Date(r.at).toLocaleTimeString()}</span></summary><pre>{JSON.stringify(r,null,2)}</pre></details>):<p className="empty-inline">运行实验后，可以在这里检查实际记录。</p>}</> }</div></section></div>}
 </div>
}
