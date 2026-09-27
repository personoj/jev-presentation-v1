import {useCallback, useEffect, useLayoutEffect, useRef, useState,type ReactNode} from 'react';
import {APIError, evaluate} from '../../shared/api';
import type {Evaluation, FeatureProps} from '../../shared/types';
import {commitPosition, DEFAULT_SCRIPT, findCandidate, Freshness, normalized, type Candidate} from './engine';
import {LatestReviewQueue} from './review-queue';
import {Teleprompter,FollowGate,type TrackingUpdate} from './teleprompter';
import {openMicrophone, type MicrophoneSession} from './microphone';
import {FOLLOWING_QUESTION} from './judgment';
import './voice.css';
import {locateReadingLine,scriptCharacters} from './reading-visual';

const defaultSamples = [
  ['按原文', '我们使用语音识别模型，把声音转换成文字。'],
  ['注入一处差异', '我们使用语义识别模型，把声音转换成文字。'],
  ['临时插话', '这里我补充一下，这个演示用的是流式语音识别，大家可以看一下效果。'],
  ['回到原文', '程序结合稿件中的前后内容，判断当前读到了什么位置。'],
] as const;
type Trace = {segmentId:string; heard: string; candidate: string; baseline: number; enhanced: number; state: string};

type LiveLatency={localMs:number|null;jevMs:number|null;firstTextMs:number|null;updateGapMs:number|null;queueMs:number|null;chunkMs:number};
export type VoiceView={script:string;confirmed:number;tentative:number;focusPosition:number;focusConfirmed:boolean;latency:LiveLatency;asrModel:string;gateState:string;followingProbability:number|null;focusRange:{start:number;end:number}|null;seek:(position:number)=>void;status:string;mic:'off'|'starting'|'on'|'stopping';level:number;heard:string;error:string;isPaused:boolean;signalActive:boolean;previewing:boolean;start:()=>Promise<void>;stop:()=>void;reset:()=>void;preview:(text:string)=>void;stopPreview:()=>void;edit:(text:string)=>void};
export function VoiceLab({onRecord, onQuota,initialScript=DEFAULT_SCRIPT,samples=defaultSamples,render,sampleUrl}: FeatureProps&{initialScript?:string;samples?:ReadonlyArray<readonly[string,string]>;render?:(data:VoiceView)=>ReactNode;sampleUrl?:string}) {
  const [script, setScript] = useState(initialScript), [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(0), [tentative, setTentative] = useState(0), [baseline, setBaseline] = useState(0);
  const [status, setStatus] = useState('准备就绪，等待朗读'), [mic, setMic] = useState<'off'|'starting'|'on'|'stopping'>('off');
  const [level, setLevel] = useState(0), [heard, setHeard] = useState(''), [input, setInput] = useState(samples[0][1] as string);
  const [candidate, setCandidate] = useState<Candidate|null>(null), [result, setResult] = useState<Evaluation|null>(null);
  const [error, setError] = useState(''), [mode, setMode] = useState<'test'|'live'>('test'), [trace, setTrace] = useState<Trace[]>([]);
  const [latency,setLatency]=useState<LiveLatency>({localMs:null,jevMs:null,firstTextMs:null,updateGapMs:null,queueMs:null,chunkMs:40});
  const [asrModel,setAsrModel]=useState('');
  const gate=useRef(new FollowGate());
  const [gateState,setGateState]=useState('unknown'),[followingProbability,setFollowingProbability]=useState<number|null>(null);
  const [focusRange,setFocusRange]=useState<{start:number;end:number}|null>(null);
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
  const progress=useRef(new Teleprompter());
  function showFocus(update:TrackingUpdate){
    const tracker=progress.current;if(!tracker.commit(update)||!update.candidate)return;
    const match=update.candidate;
    positions.current.confirmed=tracker.confirmed;setConfirmed(tracker.confirmed);setTentative(tracker.position);
    setActiveSpan({start:match.start,end:tracker.position,confirmed:tracker.confirmed>=tracker.position});setFocusPosition(tracker.position);setFocusConfirmed(tracker.confirmed>=tracker.position);
    setFocusRange(match.semantic?{start:match.start,end:match.end}:null);
  }
  const positions = useRef({confirmed:0, baseline:0}), segment = useRef({id:'', anchor:0});
  const freshness = useRef(new Freshness()),lastInput=useRef('');
  const reviews=useRef<LatestReviewQueue<{state:unknown;version:number},Evaluation>|null>(null);
  if(!reviews.current)reviews.current=new LatestReviewQueue((job,signal)=>evaluate(job.state,{following:FOLLOWING_QUESTION},{signal,stateVersion:job.version}));
  const session = useRef<MicrophoneSession|null>(null), mounted = useRef(true), micGeneration = useRef(0);
  const receiver = useRef<(text:string, final:boolean, id:string,stableText?:string)=>void>(()=>{});
  const inputMode=useRef<'test'|'live'>('test');
  function invalidate() { freshness.current.next();reviews.current?.cancel();lastInput.current=''; }
  function cancelPreview(){previewGeneration.current++;clearTimeout(previewTimer.current);setPreviewing(false);}
  function clearPreviewInput(){cancelPreview();invalidate();setTentative(positions.current.confirmed);setActiveSpan(null);setHeard('');setHeardPhase('empty');setCandidate(null);setResult(null);setStatus('等待新的转写片段');}
  function reset() { cancelPreview();invalidate();progress.current.reset();gate.current.reset();setGateState('unknown');setFollowingProbability(null);setFocusRange(null); positions.current={confirmed:0,baseline:0}; segment.current={id:'',anchor:0}; setConfirmed(0);setBaseline(0);setTentative(0);setFocusPosition(0);setFocusConfirmed(false);setCandidate(null);setResult(null);setHeard('');setHeardPhase('empty');setActiveSpan(null);setError('');setTrace([]);setStatus('已回到稿件开头'); }
  useEffect(()=>()=>{mounted.current=false;micGeneration.current++;previewGeneration.current++;clearTimeout(previewTimer.current);session.current?.dispose();invalidate();},[]);
  // React StrictMode remounts effects in development.
  useEffect(()=>{mounted.current=true;},[]);

  receiver.current = (text, final, id) => {
    const receivedAt=performance.now(),spoken=normalized(text).text;
    const signature=JSON.stringify([id,spoken,final]);if(lastInput.current===signature)return;
    const update=progress.current.propose(script,text,final,id);if(!update)return;
    if(segment.current.id!==id){invalidate();segment.current={id,anchor:progress.current.anchor}}
    lastInput.current=signature;const version=freshness.current.next();setError('');
    setHeard(text);setHeardPhase(final?'final':'partial');setCandidate(update.candidate);
    setLatency(old=>({...old,localMs:Math.round((performance.now()-receivedAt)*100)/100}));
    const baselineMatch=final?findCandidate(script,text,positions.current.baseline):null;
    if(final&&baselineMatch&&baselineMatch.similarity>=.85){positions.current.baseline=commitPosition(positions.current.baseline,baselineMatch.end);setBaseline(positions.current.baseline)}
    const record=(state:string,output?:Evaluation)=>{
      const item={segmentId:id,heard:text,candidate:update.candidate?.text??'',baseline:positions.current.baseline,enhanced:positions.current.confirmed,state};
      setTrace(old=>[...old.filter(entry=>entry.segmentId!==id).slice(-11),item]);
      if(final||output)onRecord?.({id:output?.requestId??crypto.randomUUID(),label:sampleUrl&&inputMode.current==='live'?'样本音频真实链路':'跟读状态监测',at:new Date().toISOString(),input:{text,script,segmentId:id,final,inputSource:inputMode.current,candidate:update.candidate},output:output??item,source:output?'live':'rules'});
    };
    gate.current.observe(update);
    if(gate.current.mayTrack(update)){showFocus(update);setStatus(final?'已确认 · 本地稿件定位':'暂定 · 本地实时跟随')}
    else setStatus(gate.current.state==='paused'?'暂停 · 等待恢复跟读':'保持位置 · 等待跟读信号');
    record('本地定位，Jev 独立监测跟读状态');
    if(normalized(update.text).text.length<3)return;
    reviews.current!.enqueue({
      key:JSON.stringify([id,normalized(update.text).text]),
      value:{version,state:{transcript:update.text,manuscript:script,localAlignedText:update.candidate?.text??'',recentTranscripts:gate.current.context(update)}},
      apply:output=>{
        if(!freshness.current.isCurrent(version))return;
        const probability=output.answers.following?.noul;if(probability===undefined)return;
        gate.current.decide(probability);setGateState(gate.current.state);setFollowingProbability(probability);
        setLatency(old=>({...old,jevMs:output.elapsedMs}));setResult(output);
        if(gate.current.mayTrack(update,true)){showFocus(update);setStatus(final?'已确认 · 正在跟读':'暂定 · 正在跟读')}
        else if(gate.current.state==='paused')setStatus('暂停 · 当前是插话');
        else setStatus('保持位置 · 跟读状态尚不明确');
        record(gate.current.state,output);
      },
      fail:e=>{
        if(!freshness.current.isCurrent(version))return;
        gate.current.unavailable();setGateState('paused');setFollowingProbability(null);
        const message=e instanceof Error?e.message:'判断请求未完成';setError(message);setStatus('保持位置 · 跟读监测暂不可用');
        if(e instanceof APIError&&/QUOTA|CREDIT|BALANCE|BUDGET/i.test(e.code))onQuota?.(message);record('跟读监测失败');
      }
    });
  };
  const seekRef=useRef<(position:number)=>void>(()=>{});
  seekRef.current=(position)=>{clearPreviewInput();progress.current.seek(position);gate.current.reset();setGateState('unknown');setFollowingProbability(null);positions.current.confirmed=position;setConfirmed(position);setTentative(position);setFocusPosition(position+1);setFocusRange(null);setFocusConfirmed(false);setStatus('手动定位 · 从这一句继续')};
  const seek=useCallback((position:number)=>seekRef.current(position),[]);
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
    clearPreviewInput();setLatency({localMs:null,jevMs:null,firstTextMs:null,updateGapMs:null,queueMs:null,chunkMs:40});const generation=++micGeneration.current;inputMode.current='live';setMic('starting');setError('');setMode('live');invalidate();
    try {
      const next=await openMicrophone(event=>{
        if(!mounted.current||generation!==micGeneration.current)return;
        if(event.type==='ready'){setAsrModel(event.model??'');setMic('on');setStatus(sampleUrl?'正在识别样本音频':'麦克风已连接，请按稿朗读');}
        if(event.timing)setLatency(old=>({...old,...event.timing}));
        if((event.type==='partial'||event.type==='final')&&event.text)receiver.current(event.text,event.type==='final',event.segmentId??'current',event.stableText);
        if(event.type==='stopped'){setMic('off');setLevel(0);setHeardPhase(phase=>phase==='partial'?'cancelled':phase);}
        if(event.type==='error'){invalidate();setTentative(positions.current.confirmed);setActiveSpan(null);setMic('off');setLevel(0);setHeardPhase(phase=>phase==='partial'?'cancelled':phase);setError(event.message??'语音服务未完成');setStatus(event.code==='TIMEOUT'?'语音结束确认超时':'语音服务未完成');onRecord?.({id:crypto.randomUUID(),label:'语音服务错误',at:new Date().toISOString(),input:{script},output:{code:event.code,message:event.message},source:'live'});if(/QUOTA|CREDIT|BALANCE|BUDGET/i.test(event.code??''))onQuota?.(event.message??'语音服务额度不足');}
      },value=>{if(mounted.current)setLevel(value);},{sampleUrl});
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
  if(render)return render({script,confirmed,tentative,focusPosition,focusConfirmed,focusRange,seek,gateState,followingProbability,latency,asrModel,status,mic,level,heard,error,isPaused,signalActive,previewing,start,stop,reset,preview:startPreview,stopPreview,edit:(text)=>{setScript(text);reset()}});
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
    <details name="voice-details" className="voice-method"><summary>查看匹配过程与对照</summary><div className="voice-switch"><button aria-pressed={view==='enhanced'} onClick={()=>setView('enhanced')}>本地跟踪 ＋ 跟读开关</button><button aria-pressed={view==='baseline'} onClick={()=>setView('baseline')}>仅局部对齐</button></div><p>两条路径使用同一份转写和本地文字对齐。Jev 只通过 Noul 判断是否仍在跟读，不返回句子或位置：跟读概率至少 0.65 时继续，不高于 0.35 时暂停，中间区域维持上一次状态。暂停时高亮保持，恢复后继续使用本地匹配位置。近义表达只能近似对应一个片段，因此显示片段高亮。这里的阈值是演示设定。</p><dl><dt>识别原文 · {heardPhase==='partial'?'暂定':heardPhase==='final'?'最终':'等待'}</dt><dd>{heard||'尚无转写'}</dd><dt>局部候选</dt><dd>{candidate?.text||'尚无候选'}{candidate&&<small>{candidate.semantic?' · 当前局部语义候选':` · 字符相似度 ${(candidate.similarity*100).toFixed(1)}%`}</small>}</dd><dt>确认 / 暂定</dt><dd>{confirmed} / {tentative}</dd><dt>最近 Jev 返回</dt><dd>{result?<><span>{result.model} · {result.elapsedMs} ms</span><pre>{JSON.stringify(result.answers,null,2)}</pre></>:'当前没有模型返回值。精确匹配由程序处理。'}</dd></dl>{trace.length>0&&<div className="voice-trace"><table><thead><tr><th>同一转写</th><th>仅对齐</th><th>＋ Jev</th><th>状态</th></tr></thead><tbody>{trace.map((t,i)=><tr key={i}><td>{t.heard}</td><td>{t.baseline}</td><td>{t.enhanced}</td><td>{t.state}</td></tr>)}</tbody></table></div>}</details>
  </section>;
}





