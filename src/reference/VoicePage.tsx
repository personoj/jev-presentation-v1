import {useState} from 'react';
import {VoiceLab,type VoiceView} from '../features/alignment/VoiceLab';
import {ReadingManuscript} from './ReadingManuscript';
import type {FeatureProps} from '../shared/types';
import {Art,Diagram,Ink,Line,Text} from './primitives';
import {Heading} from './ConceptPages';

const lines=['我们把声音转换成文字。','按稿朗读时，画面跟着走。','临时插话后，再回到原文。'];
const aside='这里我补充一下，大家可以看看这个演示的效果。';
const audioQA=new URLSearchParams(location.search).has('audio-qa');
export function VoicePage(props:FeatureProps){return <VoiceLab {...props} sampleUrl={audioQA?'/fixtures/reading-chain.wav':undefined} initialScript={audioQA?'我们使用语音识别模型。\n把声音转换成文字。\n然后继续按照稿件朗读。':lines.join('\n')} render={data=><VoiceCanvas data={data}/>}/>}
function VoiceCanvas({data:d}:{data:VoiceView}){
 const [details,setDetails]=useState(false);
 const chunks=d.script.split('\n');
 const status=d.isPaused?'位置保持':d.signalActive||d.confirmed>0?'跟随中':'准备朗读';
 return <div className="r-lesson r-voice-page">
  <Heading size={75} lead={<>ASR 先把声音转换成文字，程序结合稿件定位。遇到局部差异时，再由 Jev 辅助判断是否仍在按稿朗读。</>}>念稿时跟随，<span className="r-red">插话时停住</span></Heading>
  <Art src="10-voice" box={[120,270,1450,100]}/>{['声音','转写文字','对齐与判断','稿件位置'].map((s,i)=><Text key={s} x={[279,631,983,1368][i]} y={299} size={31} weight={500}>{s}</Text>)}<Diagram>{[427,800,1170].map(x=><Ink key={x} d={`M${x} 316h61`} color="var(--r-red)" width={2} arrow/>)}</Diagram>
  <Art src="10-voice" box={[98,369,877,362]}/><ReadingManuscript script={d.script} position={d.isPaused?d.confirmed:d.focusPosition} confirmed={d.confirmed} paused={d.isPaused} settled={d.isPaused||d.focusConfirmed}/>
  <Text x={1080} y={399} w={400} size={62} weight={700} color="var(--r-red)" align="center" style={{transition:'color .4s'}}>{status}</Text>
  <svg className={`r-waveform ${d.signalActive?'is-active':''}`} viewBox="0 0 670 128" aria-hidden="true">{Array.from({length:93},(_,i)=>{const envelope=Math.exp(-(((i-19)/8)**2))+.65*Math.exp(-(((i-40)/7)**2))+.4*Math.exp(-(((i-72)/12)**2)),h=3+envelope*(20+Math.sin(i*2.8)**2*76);return <line key={i} x1={i*7.2} x2={i*7.2} y1={64-h/2} y2={64+h/2} stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" opacity={i<65?.95:.25} style={{animationDelay:`${-i*.074}s`,transformOrigin:`${i*7.2}px 64px`,scale:`1 ${d.mic==='on'?.3+Math.min(1,d.level*20):1}`}}/>})}</svg>
  <Text x={1035} y={614} w={220} size={31} align="center">插话时：<br/><span className="r-red">保持位置</span></Text><i className="r-divider" style={{left:1275,top:619,height:63}}/><Text x={1284} y={614} w={220} size={31} align="center">回稿后：<br/><span className="r-red">继续定位</span></Text>
  <Line x={135} y={707} w={61} color="var(--r-red)"/><Text x={218} y={686} size={30}>声音识别、文本判断和位置更新，各自负责一步。</Text>
  <Art src="10-voice" box={[150,735,1400,121]}/><button className="r-voice-button r-mic" style={{left:168,width:324}} disabled={d.mic==='starting'||d.mic==='stopping'} onClick={()=>d.mic==='off'?void d.start():d.stop()}><svg viewBox="0 0 40 54" aria-hidden="true"><rect x="12" y="2" width="16" height="30" rx="8" fill="currentColor"/><path d="M6 23v4a14 14 0 0028 0v-4M20 41v9M11 50h18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>{d.mic==='off'?(audioQA?'播放样本音频':'开启麦克风'):d.mic==='starting'?'正在连接…':d.mic==='stopping'?'正在结束…':'停止录音'}</button>
  <button className="r-voice-button" style={{left:516,width:313}} disabled={d.mic!=='off'} onClick={()=>{d.reset();d.preview(chunks.slice(0,2).join('\n'))}}>按稿朗读</button>
  <button className="r-voice-button green" style={{left:855,width:309}} disabled={d.mic!=='off'} onClick={()=>d.preview(aside)}>临时插话</button>
  <button className="r-voice-button" style={{left:1190,width:320}} disabled={d.mic!=='off'} onClick={()=>d.preview(chunks.at(-1)||d.script)}>回到原文</button>
  {d.error&&<p className="r-voice-error" role="alert">{d.error}</p>}
  <button className="r-voice-details-toggle" onClick={()=>setDetails(!details)} aria-expanded={details}>转写与稿件 ↗</button>
  {details&&<div className="r-voice-details" role="dialog" aria-modal="true" aria-label="转写与稿件"><button autoFocus className="r-close" aria-label="关闭转写面板" onClick={()=>setDetails(false)}>×</button><h2>转写与稿件</h2><p role="status">{d.status} · 确认位置 {d.confirmed}</p><p>{d.heard||'尚无转写'}</p><dl className="r-live-latency"><dt>首段 ASR</dt><dd>{d.latency.firstTextMs??'—'} ms</dd><dt>最近更新间隔</dt><dd>{d.latency.updateGapMs??'—'} ms</dd><dt>本地匹配</dt><dd>{d.latency.localMs??'—'} ms</dd><dt>Jev 请求</dt><dd>{d.latency.jevMs??'—'} ms</dd><dt>上传积压</dt><dd>{d.latency.queueMs??'—'} ms</dd></dl>{audioQA&&<p className="r-audio-qa-label">样本音频 → 浏览器音频处理 → 云端 ASR → 稿件定位。未采集麦克风。</p>}<label>朗读稿<textarea value={d.script} disabled={d.mic!=='off'} onChange={e=>d.edit(e.target.value)} maxLength={150}/></label><div><button onClick={d.reset}>从头开始</button><button disabled={d.mic!=='off'} onClick={()=>d.preview('我们把声音转化成文字。')}>测试一处差异</button>{d.previewing&&<button onClick={d.stopPreview}>停止预览</button>}</div></div>}
 </div>
}

