import {useEffect,useRef,useState} from 'react';
import {totals,type ChapterData} from './abm-data';
import {CHART,chartScale,stepTrace} from './abm-chart';
import timing from '../../production/abm-pages/build/timeline.json';
export function AbmComparisonChart({data,round,emphasize}:{data:ChapterData;round:number;emphasize:boolean}){
 const [position,setPosition]=useState(round),cursor=useRef(round);
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||Math.abs(round-cursor.current)>1){cursor.current=round;setPosition(round);return}
  const start=cursor.current,time=performance.now();let frame=0;
  const tick=(now:number)=>{const p=Math.min(1,(now-time)/timing.chartStepMs);cursor.current=start+(round-start)*(1-Math.pow(1-p,2));setPosition(cursor.current);if(p<1)frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[round]);
 const no=data.no.map(s=>totals(s).units),yes=data.yes.map(s=>totals(s).units),maximum=chartScale([no,yes]);
 const a=stepTrace(no,position,maximum),b=stepTrace(yes,position,maximum),band=`${b.path} ${[...a.points].reverse().map(p=>`L${p.x},${p.y}`).join(' ')} Z`;
 const x=(r:number)=>CHART.left+(CHART.right-CHART.left)*r/12,y=(v:number)=>CHART.bottom-(CHART.bottom-CHART.top)*v/maximum;
 const difference=yes[round]-no[round],extra=totals(data.yes[round]).revenue-totals(data.no[round]).revenue;
 const percent=no[round]?Math.round(difference/no[round]*100):0;
 return <div className={`abm-comparison-chart ${emphasize?'emphasized':''}`}>
  <div className="abm-chart-heading">{emphasize?'券到期后，差距仍在拉开':'累计成交，怎样逐轮拉开？'}</div>
  <div className="abm-chart-legend"><span><i/>无券</span><span><i/>有券</span><small>累计成交 / 件</small></div>
  <svg className="abm-chart-svg" viewBox="0 0 1090 244" role="img" aria-label={`第${round}轮累计成交：无券${no[round]}件，有券${yes[round]}件，相差${difference}件`}>
   <defs><linearGradient id="abm-gap-wash" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#b65a39" stopOpacity={emphasize?'.23':'.13'}/><stop offset="1" stopColor="#b65a39" stopOpacity=".025"/></linearGradient></defs>
   {[0,maximum/4,maximum/2,maximum*3/4,maximum].map(v=><g key={v}><line x1={CHART.left} x2={CHART.right} y1={y(v)} y2={y(v)} stroke="#b9ac9645"/><text x={42} y={y(v)+7} textAnchor="end" className="abm-axis-label">{v}</text></g>)}
   <line x1={x(6)} x2={x(6)} y1={10} y2={CHART.bottom} stroke="#9b8866" strokeDasharray="4 6"/><text x={x(6)} y={14} textAnchor="middle" className="abm-expiry-label">第6轮 · 券到期</text>
   <path d={band} fill="url(#abm-gap-wash)"/>
   <path d={a.path} className="abm-series baseline"/><path d={b.path} className="abm-series policy"/>
   <circle cx={a.end.x} cy={a.end.y} r={5} fill="var(--r-blue)" stroke="#fff6e4" strokeWidth={2}/><circle cx={b.end.x} cy={b.end.y} r={5} fill="var(--r-red)" stroke="#fff6e4" strokeWidth={2}/>
   {round>0&&<><text x={b.end.x+15} y={b.end.y-8} className="abm-end-value policy">{yes[round]}</text><text x={a.end.x+15} y={a.end.y+22} className="abm-end-value baseline">{no[round]}</text></>}
   {Array.from({length:13},(_,i)=><text key={i} x={x(i)} y={223} textAnchor="middle" className={`abm-axis-label ${i===round?'current':''}`}>{i}</text>)}<text x={1007} y={223} className="abm-axis-label">轮</text>
   {emphasize&&[6,10].map(r=><g key={r} className="abm-gap-callout"><line x1={x(r)} x2={x(r)} y1={y(yes[r])+5} y2={y(no[r])-5} stroke="var(--r-red)" strokeWidth={2}/><rect x={x(r)-30} y={(y(yes[r])+y(no[r]))/2-15} width={60} height={30} rx={15} fill="#f7ecda" stroke="#b98d6c80"/><text x={x(r)} y={(y(yes[r])+y(no[r]))/2+8} textAnchor="middle">+{yes[r]-no[r]}</text></g>)}
  </svg>
  <aside className="abm-gap-summary" aria-live="off">
   <span>{difference?'有券组累计多成交':'从相同的起点出发'}</span>
   {difference?<><strong>+{difference}<em> 件</em></strong><p>比无券组增加 <b>{percent}%</b></p><div>交易额多 <b>{extra}</b></div></>:<><strong className="abm-gap-pending">观察差异</strong><p>每个居民，分别选择</p><div>两组按同一轮次推进</div></>}
  </aside>
 </div>;
}
