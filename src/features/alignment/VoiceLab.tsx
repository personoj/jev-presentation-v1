import {useEffect, useLayoutEffect, useRef, useState,type ReactNode} from 'react';
import {APIError, evaluate} from '../../shared/api';
import type {Evaluation, FeatureProps} from '../../shared/types';
import {acceptJudgment, classifyCandidate, commitPosition, DEFAULT_SCRIPT, findCandidate, Freshness, normalized, type Candidate} from './engine';
import {openMicrophone, type MicrophoneSession} from './microphone';
import {ALIGNMENT_QUESTION} from './judgment';
import './voice.css';
import {locateReadingLine,scriptCharacters} from './reading-visual';

const defaultSamples = [
  ['按原文', '我们使用语音识别模型，把声音转换成文字。'],
  ['注入一处差异', '我们使用语义识别模型，把声音转换成文字。'],
  ['临时插话', '这里我补充一下，这个演示用的是流式语音识别，大家可以看一下效果。'],
  ['回到原文', '程序结合稿件中的前后内容，判断当前读到了什么位置。'],
] as const;
type Trace = {segmentId:string; heard: string; candidate: string; baseline: number; enhanced: number; state: string};

export type VoiceView={script:string;confirmed:number;tentative:number;focusPosition:number;status:string;mic:'off'|'starting'|'on'|'stopping';level:number;heard:string;error:string;isPaused:boolean;signalActive:boolean;previewing:boolean;start:()=>Promise<void>;stop:()=>void;reset:()=>void;preview:(text:string)=>void;stopPreview:()=>void;edit:(text:string)=>void};
export function VoiceLab({onRecord, onQuota,initialScript=DEFAULT_SCRIPT,samples=defaultSamples,render}: FeatureProps&{initialScript?:string;samples?:ReadonlyArray<readonly[string,string]>;render?:(data:VoiceView)=>ReactNode}) {
  const [script, setScript] = useState(initialScript), [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(0), [tentative, setTentative] = useState(0), [baseline, setBaseline] = useState(0);
  const [status, setStatus] = useState('准备就绪，等待朗读'), [mic, setMic] = useState<'off'|'starting'|'on'|'stopping'>('off');
  const [level, setLevel] = useState(0), [heard, setHeard] = useState(''), [input, setInput] = useState(samples[0][1] as string);
  const [candidate, setCandidate] = useState<Candidate|null>(null), [result, setResult] = useState<Evaluation|null>(null);
  const [error, setError] = useState(''), [mode, setMode] = useState<'test'|'live'>('test'), [trace, setTrace] = useState<Trace[]>([]);
  const [view, setView] = useState<'enhanced'|'baseline'>('enhanced');
  const [heardPhase,setHeardPhase]=useState<'empty'|'partial'|'final'|'cancelled'>('empty');
  const [activeSpan,setActiveSpan]=useState<{start:number;end:number;confirmed:boolean}|null>(null);
  const [previewing,setPreviewing]=useState(false);
  const previewTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),previewGeneration=useRef(0);
  const [focusPosition,setFocusPosition]=useState(0),[focusConfirmed,setFocusConfirmed]=useState(false);
  const [lineFocus,setLineFocus]=useState<ReturnType<typeof locateReadingLine>>(null);
  const manuscriptElement=useRef<HTMLParagraphElement>(null);
  useLayoutEffect(()=>{
    const element=manuscriptElement.current;if(!element||editing){setLineFocus(null);return;}
    const measure=()=>{const origin=element.getBoundingClientRect();const rects=[...element.querySelectorAll<HTMLElement>('[data-script-start]')].map(span=>{const box=span.getBoundingClientRect();return {start:Number(span.dataset.scriptStart),end:Number(span.dataset.scriptEnd),left:box.left-origin.left,right:box.right-origin.left,top:box.top-origin.top,bottom:box.bottom-origin.top};});setLineFocus(locateReadingLine(rects,focusPosition));};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[focusPosition,script,editing]);
  function showFocus(start:number,end:number,isConfirmed:boolean){setActiveSpan({start,end,confirmed:isConfirmed});setFocusPosition(end);setFocusConfirmed(isConfirmed);}
  const positions = useRef({confirmed:0, baseline:0}), segment = useRef({id:'', anchor:0});
  const freshness = useRef(new Freshness()), abort = useRef<AbortController|null>(null), timer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const session = useRef<MicrophoneSession|null>(null), mounted = useRef(true), micGeneration = useRef(0);
  const receiver = useRef<(text:string, final:boolean, id:string)=>void>(()=>{});
  const inputMode=useRef<'test'|'live'>('test');
  function invalidate() { freshness.current.next(); abort.current?.abort(); clearTimeout(timer.current); }
  function cancelPreview(){previewGeneration.current++;clearTimeout(previewTimer.current);setPreviewing(false);}
  function clearPreviewInput(){cancelPreview();invalidate();setTentative(positions.current.confirmed);setActiveSpan(null);setHeard('');setHeardPhase('empty');setCandidate(null);setResult(null);setStatus('等待新的转写片段');}
  function reset() { cancelPreview();invalidate(); positions.current={confirmed:0,baseline:0}; segment.current={id:'',anchor:0}; setConfirmed(0);setBaseline(0);setTentative(0);setFocusPosition(0);setFocusConfirmed(false);setCandidate(null);setResult(null);setHeard('');setHeardPhase('empty');setActiveSpan(null);setError('');setTrace([]);setStatus('已回到稿件开头'); }
  useEffect(()=>()=>{mounted.current=false;micGeneration.current++;previewGeneration.current++;clearTimeout(previewTimer.current);session.current?.dispose();invalidate();},[]);
  // React StrictMode remounts effects in development.
  useEffect(()=>{mounted.current=true;},[]);

  receiver.current = (text, final, id) => {
    invalidate(); const version = freshness.current.next(); setHeard(text);setHeardPhase(final?'final':'partial'); setError('');
    if(segment.current.id !== id) segment.current={id,anchor:positions.current.confirmed};
    const match = findCandidate(script,text,segment.current.anchor), decision=classifyCandidate(match,text);
    setCandidate(match);setResult(null);
    const baselineMatch=findCandidate(script,text,positions.current.baseline);
    if(final && baselineMatch && baselineMatch.similarity>=0.85 && normalized(text).text.length>=6) {
      positions.current.baseline=commitPosition(positions.current.baseline,baselineMatch.end);setBaseline(positions.current.baseline);
    }
    const record = (state:string, output?:Evaluation, failed=false) => {
      const item={segmentId:id,heard:text,candidate:match?.text??'',baseline:positions.current.baseline,enhanced:positions.current.confirmed,state};
      // Revisions replace this segment's local preview; they never crowd out whole experiments.
      setTrace(old=>[...old.filter(entry=>entry.segmentId!==id).slice(-11),item]);
      if(final||output||failed)onRecord?.({id:output?.requestId??crypto.randomUUID(),label:inputMode.current==='live'?'实时跟读定位':'转写测试',at:new Date().toISOString(),input:{text,script,segmentId:id,candidate:match,final,inputSource:inputMode.current},output:output??item,source:output?'live':'rules'});
    };
    const apply = (accepted:boolean,label:string, output?:Evaluation) => {
      if(!freshness.current.isCurrent(version))return;
      if(accepted&&match){setTentative(match.end);showFocus(match.start,match.end,final);if(final){positions.current.confirmed=commitPosition(positions.current.confirmed,match.end);setConfirmed(positions.current.confirmed);}}
      else {setTentative(positions.current.confirmed);setActiveSpan(null);}
      setStatus(label);record(label,output);
    };
    if(decision==='short'){setTentative(positions.current.confirmed);setActiveSpan(null);setStatus('片段较短，等待更多文字');record('片段较短，等待更多文字');return;}
    if(decision==='exact'){apply(true,final?'已确认 · 对应原文':'暂定 · 等待转写稳定');return;}
    // An unrelated fragment cannot pass the lexical gate. Hold immediately instead of
    // spending a model call whose answer could never be accepted by acceptJudgment.
    if(decision==='pause'){apply(false,'暂停 · 这段内容不在稿件中');return;}
    setTentative(match&&match.similarity>=0.8?match.end:positions.current.confirmed);
    if(match&&match.similarity>=0.8)showFocus(match.start,match.end,false);else setActiveSpan(null);
    setStatus('暂缓推进 · 正在核对局部差异');
    const review=async()=>{
      const controller=new AbortController();abort.current=controller;
      try {
        const output=await evaluate({transcript:text,localScript:script.slice(Math.max(0,segment.current.anchor-45),segment.current.anchor+180),candidate:match?.text??'',task:'按稿朗读，允许少量转写错字；不允许大幅改述或话题相关插话。'},
          {alignment:ALIGNMENT_QUESTION},
          {signal:controller.signal,stateVersion:version});
        if(!freshness.current.isCurrent(version))return;
        setResult(output);const answer=output.answers.alignment;
        const matchProbability=answer?.probabilities?.match;const noMatchProbability=answer?.probabilities?.no_match;
        const preferred=matchProbability!==undefined&&noMatchProbability!==undefined&&matchProbability>noMatchProbability?'match':'no_match';
        const accepted=acceptJudgment(match,preferred,matchProbability);
        apply(accepted,accepted?(final?'已确认 · 容忍局部差异':'暂定 · 局部差异可接受'):'暂停 · 尚不能确认对应原文',output);
      }catch(e){if(!freshness.current.isCurrent(version)||controller.signal.aborted)return;setTentative(positions.current.confirmed);setActiveSpan(null);const message=e instanceof Error?e.message:'判断请求未完成';setError(message);setStatus('保持位置 · 判断未完成');if(e instanceof APIError&&/QUOTA|CREDIT|BALANCE|BUDGET/i.test(e.code))onQuota?.(message);record('请求失败，保持位置',undefined,true);}
    };
    if(final)void review();else timer.current=setTimeout(()=>void review(),800);
  };
  function startPreview(text=input){
    clearPreviewInput();inputMode.current='test';setMode('test');setPreviewing(true);
    const generation=previewGeneration.current,id=crypto.randomUUID(),characters=[...text];let count=0;
    const tick=()=>{if(!mounted.current||generation!==previewGeneration.current)return;
      count++;receiver.current(characters.slice(0,count).join(''),false,id);
      if(count<characters.length)previewTimer.current=setTimeout(tick,90);
      else previewTimer.current=setTimeout(()=>{if(!mounted.current||generation!==previewGeneration.current)return;receiver.current(text,true,id);setPreviewing(false);},220);
    };tick();
  }
  function stopPreview(){cancelPreview();invalidate();setTentative(positions.current.confirmed);setActiveSpan(null);setHeardPhase('cancelled');setStatus('预览已停止 · 确认位置保持');}
  async function start() {
    clearPreviewInput();const generation=++micGeneration.current;inputMode.current='live';setMic('starting');setError('');setMode('live');invalidate();
    try {
      const next=await openMicrophone(event=>{
        if(!mounted.current||generation!==micGeneration.current)return;
        if(event.type==='ready'){setMic('on');setStatus('麦克风已连接，请按稿朗读');}
        if((event.type==='partial'||event.type==='final')&&event.text)receiver.current(event.text,event.type==='final',event.segmentId??'current');
        if(event.type==='stopped'){setMic('off');setLevel(0);setHeardPhase(phase=>phase==='partial'?'cancelled':phase);}
        if(event.type==='error'){invalidate();setTentative(positions.current.confirmed);setActiveSpan(null);setMic('off');setLevel(0);setHeardPhase(phase=>phase==='partial'?'cancelled':phase);setError(event.message??'语音服务未完成');setStatus(event.code==='TIMEOUT'?'语音结束确认超时':'语音服务未完成');onRecord?.({id:crypto.randomUUID(),label:'语音服务错误',at:new Date().toISOString(),input:{script},output:{code:event.code,message:event.message},source:'live'});if(/QUOTA|CREDIT|BALANCE|BUDGET/i.test(event.code??''))onQuota?.(event.message??'语音服务额度不足');}
      },value=>{if(mounted.current)setLevel(value);});
      if(!mounted.current||generation!==micGeneration.current)next.dispose();else session.current=next;
    }catch(e){if(mounted.current&&generation===micGeneration.current){setMic('off');setError(e instanceof Error?e.message:'无法使用麦克风');setStatus('麦克风未启动');}}
  }
  function stop() {setMic('stopping');session.current?.stop();}
  const shown=view==='baseline'?baseline:confirmed;
  const isPaused=!!error||status.startsWith('暂停')||status.startsWith('保持')||status.startsWith('预览已停止');
  const isMatching=!isPaused&&(status.startsWith('暂定')||status.startsWith('暂缓'));
  const isContinuing=!isPaused&&status.startsWith('已确认');
  const indicator=isPaused?'pause':isContinuing?'continue':isMatching?'match':'listen';
  const indicatorLabel=isPaused?'暂停':isContinuing?'继续':isMatching?'匹配':'收音';
  const signalActive=mic==='on'||previewing;
  if(render)return render({script,confirmed,tentative,focusPosition,status,mic,level,heard,error,isPaused,signalActive,previewing,start,stop,reset,preview:startPreview,stopPreview,edit:(text)=>{setScript(text);reset()}});
  return <section className="voice-lab" aria-label="按稿跟读实验">
    <div className="voice-topline"><span className="voice-source">{mode==='live'?'实时跟读':'固定转写演示'}</span><span className="voice-counter">确认位置 {shown} / {script.length}</span></div>
    <div className="voice-reading">
      <div className="voice-manuscript">
        <div className="voice-page-heading"><span>朗读稿</span><button disabled={mic!=='off'} onClick={()=>{clearPreviewInput();setEditing(!editing);}}> {editing?'完成编辑':'编辑稿件'}</button></div>
        {editing?<textarea aria-label="编辑演示原稿" value={script} maxLength={2000} onChange={event=>{setScript(event.target.value);reset();}}/>:<div className="voice-script-stage" data-focus={isPaused?'paused':focusConfirmed?'confirmed':'tentative'}>{lineFocus&&<><div className="voice-line-glow" aria-hidden="true" style={{transform:`translate3d(${lineFocus.left-10}px,${lineFocus.top-6}px,0)`,width:lineFocus.width+20,height:lineFocus.height+12}}/><div className="voice-line-progress" aria-hidden="true" style={{transform:`translate3d(${lineFocus.left}px,${lineFocus.top+lineFocus.height+4}px,0)`,width:lineFocus.progress}}/></>}<p ref={manuscriptElement} className="voice-script">{scriptCharacters(script).map(({char,start,end})=><span key={start} data-script-start={start} data-script-end={end} className={[end<=shown?'read':'',lineFocus&&start>=lineFocus.start&&start<lineFocus.end?'focused-line':'',activeSpan&&!activeSpan.confirmed&&start>=activeSpan.start&&end<=activeSpan.end?'previewed':''].filter(Boolean).join(' ')}>{char}</span>)}</p></div>}
        <div className="voice-status" role="status"><span className="voice-status-dot"/>{status}</div>
      </div>
    </div>
    <aside className="voice-instrument" data-status={indicator} aria-label={'跟读状态：'+indicatorLabel}><svg className="voice-instrument-icon" viewBox="0 0 120 100" fill="none" aria-hidden="true"><path className="instrument-track" d="M12 50H108"/><path className="instrument-brackets" d="M31 20H20V80H31M89 20H100V80H89"/>{indicator==='pause'?<g className="instrument-symbol"><path d="M51 35V65M69 35V65"/></g>:indicator==='continue'?<path className="instrument-symbol" d="M45 51L56 62L78 38"/>:<g className="instrument-signal">{[0,1,2,3,4,5,6].map(i=>{const height=signalActive?8+Math.min(42,level*460+ (previewing?14:0))*(.4+.6*Math.sin(i*1.2)**2):8;return <line key={i} x1={36+i*8} x2={36+i*8} y1={50-height/2} y2={50+height/2}/>;})}</g>}</svg><strong>{indicatorLabel}</strong><span>{isPaused?'位置保持':isContinuing?'已确认稿件位置':isMatching?'暂定位置，等待确认':mic==='starting'?'正在连接麦克风':signalActive?(previewing?'正在接收文字':'正在接收语音'):'等待开始朗读'}</span><div className="voice-instrument-steps">{['收音','匹配','暂停','继续'].map(name=><i key={name} className={name===indicatorLabel?'active':''}>{name}</i>)}</div></aside>
    <div className="voice-controls">
      <button className="voice-primary" disabled={mic==='starting'||mic==='stopping'||editing||!script.trim()} onClick={()=>mic==='off'?void start():stop()}>{mic==='off'?'开启麦克风':mic==='starting'?'正在连接…':mic==='stopping'?'正在结束…':'停止录音'}</button>
      <button disabled={mic!=='off'} onClick={reset}>从头开始</button>{previewing&&<button onClick={stopPreview}>停止预览</button>}<span className="voice-mic-note">{previewing?'逐字播放固定转写':mic==='off'?'可用下方三个步骤试演':mic==='starting'?'正在连接麦克风':mic==='stopping'?'等待最后一段结果':'正在收音'}</span>
    </div>
    <div className="voice-quick-demo" role="group" aria-label="固定转写演示"><span>固定转写</span>{[[0,'① 按稿朗读'],[2,'② 临时插话'],[3,'③ 回到原文']].map(([sample,label])=><button key={sample} disabled={mic!=='off'||editing} onClick={()=>{const text=samples[Number(sample)][1];if(sample===0)reset();setInput(text);startPreview(text);}}>{label}</button>)}</div>
    {error&&<p className="voice-error" role="alert">{error}</p>}
    <details name="voice-details" className="voice-test"><summary>转写测试 <span>原文、局部差异、插话、返回</span></summary><p>人为输入演示，不采集声音。逐字预览会在稿件上显示暂定位置，最后提交稳定文本。</p><div className="voice-presets">{samples.map(([label,text])=><button disabled={mic!=='off'} key={label} onClick={()=>{clearPreviewInput();setInput(text);}}>{label}</button>)}</div><textarea aria-label="测试转写文本" disabled={mic!=='off'} value={input} maxLength={350} onChange={e=>{clearPreviewInput();setInput(e.target.value);}}/><div className="voice-test-actions"><button className="voice-preview-button" disabled={mic!=='off'||editing||!input.trim()} onClick={()=>previewing?stopPreview():startPreview()}>{previewing?'停止预览':'逐字预览'}</button><button className="voice-primary" disabled={mic!=='off'||!input.trim()||editing} onClick={()=>{cancelPreview();inputMode.current='test';setMode('test');receiver.current(input,true,crypto.randomUUID());}}>提交这段转写</button></div></details>
    <details name="voice-details" className="voice-method"><summary>查看匹配过程与对照</summary><div className="voice-switch"><button aria-pressed={view==='enhanced'} onClick={()=>setView('enhanced')}>局部对齐 ＋ Jev</button><button aria-pressed={view==='baseline'} onClick={()=>setView('baseline')}>仅局部对齐</button></div><p>两种路径读取同一段转写。仅局部对齐按相似度 ≥ 0.85 确认；加入 Jev 后，对有差异的片段额外检查。浅色下划线表示暂定位置，较深下划线表示确认位置；插话时光带保持。字符相似度 ≥ 0.9 时，要求 Jev 对应概率大于 0.5 且高于不匹配概率；其余可比候选要求 0.8。阈值为演示设定，尚未校准。</p><dl><dt>识别原文 · {heardPhase==='partial'?'暂定':heardPhase==='final'?'最终':'等待'}</dt><dd>{heard||'尚无转写'}</dd><dt>局部候选</dt><dd>{candidate?.text||'尚无候选'}{candidate&&<small> · 字符相似度 {(candidate.similarity*100).toFixed(1)}%</small>}</dd><dt>确认 / 暂定</dt><dd>{confirmed} / {tentative}</dd><dt>最近 Jev 返回</dt><dd>{result?<><span>{result.model} · {result.elapsedMs} ms</span><pre>{JSON.stringify(result.answers,null,2)}</pre></>:'当前没有模型返回值。精确匹配由程序处理。'}</dd></dl>{trace.length>0&&<div className="voice-trace"><table><thead><tr><th>同一转写</th><th>仅对齐</th><th>＋ Jev</th><th>状态</th></tr></thead><tbody>{trace.map((t,i)=><tr key={i}><td>{t.heard}</td><td>{t.baseline}</td><td>{t.enhanced}</td><td>{t.state}</td></tr>)}</tbody></table></div>}</details>
  </section>;
}





