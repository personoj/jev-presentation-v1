import {Art,Diagram,Group,Text} from './primitives';
import {choicePose,noulPose,scorePose} from './primitive-motion';
import {usePrimitiveClock} from './use-primitive-clock';
import './primitive-motion.css';

/** The parent owns all motion. There is deliberately no CSS transition on
 * this ball: a second interpolator would detach it from its label and arrow. */
function MotionBall({r=19,color='var(--r-red)',halo=0}:{r?:number;color?:string;halo?:number}){return <>
 {halo>0&&<><circle r={r*2.8} fill={color} opacity={.08*halo}/><circle r={r*1.95} fill={color} opacity={.1*halo}/></>}
 <circle r={r} fill={color} stroke="#fff9ec" strokeWidth="2"/><circle r={r-2} fill="url(#r-grain-light)"/>
 </>}
const paths=['M127 607C260 607 244 515 370 515','M127 607H370','M127 607C254 607 247 697 370 697'];
const colors=['var(--r-blue)','var(--r-red)','var(--r-green)'];

export function ChoiceDiagram(){
 const {time,driver}=usePrimitiveClock(true,'choice'),pose=choicePose(time);
 return <Group className="primitive-choice"><span ref={driver} className="primitive-clock" data-kind="choice" data-time={time.toFixed(1)}/>
  <Text x={86} y={552} size={30}>输入</Text>
  <Diagram><defs><marker id="choice-motion-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
   {paths.map((d,i)=><g key={d} opacity={i===1?1:1-.55*pose.selected}>
    <path d={d} stroke={colors[i]} strokeWidth={2.2+pose.scan[i]*1.8+(i===1?pose.selected:0)} pathLength="1" strokeDasharray="1" strokeDashoffset={1-pose.draw[i]} markerEnd="url(#choice-motion-arrow)"/>
    <g transform={`translate(397,${515+i*91})`}><MotionBall r={17+(i===1?pose.selected*2:0)} color={colors[i]} halo={pose.scan[i]+(i===1?pose.selected:0)}/></g>
   </g>)}
   <g transform="translate(127,607)"><MotionBall r={16} color="#303331"/></g>
   {pose.packetVisible&&<g transform={`translate(${pose.packetX},607)`}><MotionBall r={9} halo={.6}/></g>}
   <path d="M430 635H462" stroke="var(--r-red)" strokeWidth="2.5" pathLength="1" strokeDasharray="1" strokeDashoffset={1-pose.selected}/>
  </Diagram>
  {['A','B','C'].map((s,i)=><Text key={s} x={429} y={490+i*91} size={42} className="r-latin" color={i===1&&pose.settled?'var(--r-red)':undefined} style={{opacity:i===1?1:1-.45*pose.selected}}>{s}</Text>)}
 </Group>;
}

export function NoulDiagram({active}:{active:boolean}){
 const {time,driver}=usePrimitiveClock(active,'noul'),pose=noulPose(time);
 return <Group show={active} className="primitive-noul"><span ref={driver} className="primitive-clock" data-kind="noul" data-time={time.toFixed(1)}/>
  <Diagram><path d="M621 591H1049" stroke="var(--r-ink)" strokeWidth="2"/>{[621,728,835,942,1049].map(x=><path key={x} d={`M${x} 577V605`} stroke="var(--r-ink)" strokeWidth="2"/>)}
   <g transform="translate(621,591)"><MotionBall r={11} color="#303331"/></g><g transform="translate(1049,591)"><MotionBall r={11} color="#303331"/></g>
   <g className="primitive-noul-moving" transform={`translate(${pose.x},${pose.y})`} data-probability={pose.value.toFixed(4)}><MotionBall halo={1}/><text x="0" y="73" textAnchor="middle" fill="var(--r-ink)" fontSize="45" fontFamily="Times New Roman,serif" fontStyle="italic">p</text></g>
  </Diagram><Text x={613} y={611} size={37} className="r-latin">0</Text><Text x={1041} y={611} size={37} className="r-latin">1</Text>
 </Group>;
}

export function ScoreDiagram({active}:{active:boolean}){
 const {time,driver}=usePrimitiveClock(active,'score'),pose=scorePose(time);
 return <Group show={active} className="primitive-score"><span ref={driver} className="primitive-clock" data-kind="score" data-time={time.toFixed(1)}/>
  <Art src="06-primitives" box={[1154,506,508,203]}/>
  <Diagram><defs><marker id="score-motion-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M2 2L10 6L2 10" fill="none" stroke="var(--r-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
   <path className="primitive-score-arrow" d={pose.arrow} data-target={pose.to} stroke="var(--r-red)" strokeWidth="2" strokeDasharray="8 6" opacity={pose.arrowOpacity} markerEnd="url(#score-motion-arrow)"/>
   <g className="primitive-score-ball" transform={`translate(${pose.x},${pose.y})`} data-target={pose.to}><MotionBall/></g>
  </Diagram>{[0,1,2].map(n=><Text key={n} x={1218+n*137} y={680} size={35} className="r-latin">{n}</Text>)}
 </Group>;
}
