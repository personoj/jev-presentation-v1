import type {CSSProperties} from 'react';
import {moreApplications} from '../deck/more-applications';
import {Text} from './primitives';
import './more-applications.css';

export function MoreApplications({beat}:{beat:number}){
 return <section className="r-more-applications" aria-label="更多应用场景">
  <Text x={0} y={117} w={1672} size={72} weight={650} align="center"><span className="r-red r-latin">Jev</span> 还可以做什么？</Text>
  <Text x={0} y={217} w={1672} size={32} align="center">更多应用场景</Text>
  <ol className="more-cards">
   {moreApplications.map((item,i)=>{const visible=beat>i;return <li key={item.kind} className={`more-card more-${item.kind} ${visible?'is-visible':''} ${beat===i+1?'is-current':''}`} style={{left:62+(i%3)*523,top:284+Math.floor(i/3)*288,'--atlas-x':`${i%3*50}%`,'--atlas-y':`${Math.floor(i/3)*100}%`} as CSSProperties} aria-hidden={!visible} inert={!visible}>
    <span className="more-sequence" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
    <div className="more-picture" aria-hidden="true"><div className="more-illustration"/><svg className="more-ink" viewBox="0 0 244 206">
     {item.kind==='home'&&<ellipse className="more-lamp-glow" cx="90" cy="79" rx="60" ry="63"/>}
     {item.kind==='search'&&<path className="more-stroke" d="M51 93L119 91M51 115L137 112"/>}
     {item.kind==='citation'&&<circle className="more-citation-ring" cx="173" cy="130" r="24"/>}
     {item.kind==='driving'&&<path className="more-road-mark" d="M107 184C189 143 204 97 156 66"/>}
     {item.kind==='document'&&<path className="more-stroke" d="M143 49L199 49M143 72L199 72M143 94L186 94"/>}
     {item.kind==='review'&&<circle className="more-review-ring" cx="159" cy="70" r="20"/>}
    </svg></div>
    <h2>{item.title}</h2><p>{item.lines[0]}<br/>{item.lines[1]}</p>
   </li>})}
  </ol>
 </section>;
}
