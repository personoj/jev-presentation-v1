import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Art,Diagram,Group,Ink,Line,Text} from './primitives';

export function Heading({children,lead,center=false,size=72,x=70}:{children:ReactNode;lead?:ReactNode;center?:boolean;size?:number;x?:number}){return <><Text x={x} y={117} w={1672-x*2} size={size} weight={700} align={center?'center':'left'} line={1.3}>{children}</Text>{lead&&<Text x={x} y={center?205:229} w={1672-x*2} size={center?32:34} weight={500} align={center?'center':'left'}>{lead}</Text>}</>}
export function useTween(value:number,duration=1250){const[current,setCurrent]=useState(value),ref=useRef(value);useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){ref.current=value;setCurrent(value);return}const from=ref.current,start=performance.now();let frame=0;const update=(now:number)=>{const p=Math.min(1,(now-start)/duration),ease=p*p*p*(p*(p*6-15)+10);ref.current=from+(value-from)*ease;setCurrent(ref.current);if(p<1)frame=requestAnimationFrame(update)};frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame)},[value,duration]);return current}
export function Ball({x,y,color='var(--r-red)',r=17,halo=false}:{x:number;y:number;color?:string;r?:number;halo?:boolean}){return <g style={{transform:`translate(${x}px,${y}px)`,transition:'transform 1.6s var(--r-ease)'}}>{halo&&<><circle r={r*2.8} fill={color} opacity=".08"/><circle r={r*1.95} fill={color} opacity=".1"/></>}<circle r={r} fill={color} stroke="#fff9ec" strokeWidth="2"/><circle r={r-2} fill="url(#r-grain-light)"/></g>}
export function Comparison({beat}:{beat:number}){return <div className="r-lesson">
 <Heading center size={64} lead="同一条消息，既可以生成一段回答，也可以返回一个明确的判断。">两种输出方式，<span className="r-red">有什么不同？</span></Heading>
 <Art src="04-comparison" box={[560,248,575,128]}/><Text x={610} y={285} w={450} size={32} align="center">已经付款，订单仍显示未支付。</Text>
 <Text x={83} y={366} size={39} weight={700}>常见自回归语言模型</Text><Line x={86} y={429} w={55} color="var(--r-red)"/>
 <Text x={87} y={450} w={735} size={29} line={1.32}>根据输入和已经生成的内容，一次预测一个 token，<br/>逐步组成回答。</Text><Text x={87} y={536} w={738} size={29}>token 可以是一个字、一个词，也可能只是一个词的一部分。</Text>
 <i className="r-divider" style={{left:854,top:390,height:380}}/>
 <Text x={929} y={365} size={53} color="var(--r-red)" weight={600} className="r-latin">Jev</Text><Line x={930} y={429} w={56} color="var(--r-red)"/>
 <Text x={930} y={450} w={665} size={28} line={1.34}>先定义问题和可能的答案，再返回判断及相应的概率。<br/>程序可以直接读取结果，例如把这条消息交给对应的<br/>服务部门。</Text>
 {[{x:90,w:121,t:'请'},{x:213,w:154,t:'联系'},{x:369,w:153,t:'订单'},{x:526,w:154,t:'服务'},{x:683,w:120,t:'。'}].map((v,i)=><Group show={beat>=1} delay={i*350} key={v.t}><Art src="04-comparison" box={[v.x-6,582,v.w,151]}/><Text x={v.x} y={620} w={v.w-18} align="center" size={43} weight={600}>{v.t}</Text></Group>)}
 <Diagram><Ink d="M315 700C414 760 697 756 730 702" color="var(--r-red)" show={beat>=1} delay={1700} width={2} arrow/></Diagram>
 <Group show={beat>=1} delay={1700}><Text x={300} y={747} w={420} size={26} align="center">继续预测下一个 token</Text></Group>
 <Group show={beat>=2}><Text x={930} y={584} size={29}>该交给谁？</Text>{['订单服务','商品咨询','其他'].map((s,i)=><div key={s}><Text x={930} y={632+i*49} size={29}>{s}</Text><div className="r-bar-track" style={{left:1097,top:638+i*49,width:380,height:17}}><i style={{width:[74,30,15][i]+'%',background:i===0?'var(--r-red)':'#777'}}/></div></div>)}<Text x={1544} y={680} size={24} color="#827b71">示意</Text></Group>
 <Group show={beat>=2}><Line x={70} y={800} w={1532}/><Text x={100} y={817} w={1472} size={31} align="center">大语言模型也能输出结构化内容。<span className="r-red r-latin">Jev</span> 的特点，还在于它针对决策与概率校准进行训练。</Text></Group>
 </div>}

export function Training({beat}:{beat:number}){return <div className="r-lesson">
 <Heading center size={66} lead="除了输出方式，我们还要看模型被训练去做好什么。"><span className="r-red">训练目标，</span>也有不同</Heading>
 <Art src="05-training" box={[630,248,420,98]}/><Text x={665} y={269} w={341} size={32} align="center">已有的语言理解能力</Text>
 <Diagram><Ink d="M836 323C815 416 517 279 483 364" color="var(--r-red)" show={beat>=1} width={2} arrow/><Ink d="M836 323C888 419 1178 279 1189 364" color="var(--r-blue)" show={beat>=2} width={2} arrow/></Diagram>
 <Group show={beat>=1}><Text x={240} y={364} w={500} size={58} weight={600} color="var(--r-red)" align="center" className="r-latin">RLHF</Text><Text x={246} y={431} w={520} size={28} line={1.29}>利用人类反馈，让模型更倾向于给出人们<br/>偏好的回答。回答的表达方式、帮助程度等，<br/>都可能影响偏好。</Text><Art src="05-training" box={[200,535,581,172]}/><Text x={254} y={569} size={30}>回答 A</Text><Text x={540} y={569} size={30}>回答 B</Text><Text x={352} y={733} w={300} size={27} align="center">人的偏好反馈</Text></Group>
 <Diagram><Ink d="M624 686C565 727 185 759 185 630V430Q185 401 375 401" color="var(--r-red)" show={beat>=1} delay={800} width={2} arrow/></Diagram>
 <i className="r-divider" style={{left:836,top:395,height:356}}/>
 <Group show={beat>=2}><Text x={981} y={364} w={470} size={58} weight={600} color="var(--r-blue)" align="center" className="r-latin">RLCD</Text><Text x={981} y={431} w={475} size={28} line={1.3}>TypeSafe 将这条训练路线称为 RLCD，<br/>目标是返回明确的决策，以及能反映<br/>不确定性的概率。</Text><Text x={1133} y={525} size={104} color="var(--r-red)" className="r-latin" weight={600}>80<span style={{fontSize:80}}>%</span></Text>
 <Diagram>{Array.from({length:10},(_,i)=><circle key={i} cx={1000+i*48.3} cy={646} r={18} stroke={i<8?'#b44425':'var(--r-ink)'} strokeWidth="1.6" fill={i<8?'#b94b2b':'none'} className="r-dot-reveal" style={{animationDelay:`${i*90}ms`}}/>)}</Diagram>
 <Text x={997} y={682} w={465} size={28} align="center" line={1.3}>如果许多次判断都给出 80% 的概率，<br/>实际结果的发生比例也应接近 80%。</Text>
 <Art src="05-training" box={[389,765,907,96]}/><Text x={472} y={790} size={35} color="var(--r-green)" weight={700}>要点</Text><i className="r-divider" style={{left:575,top:791,height:42}}/><Text x={600} y={797} size={29}>校准描述的是一组预测，不保证某一次判断正确。</Text><Text x={1551} y={806} size={22} color="#827b71">示意</Text></Group>
 </div>}

export function Primitives({beat}:{beat:number}){const labels=['Choice','Noul','Score'],questions=['选哪个？','是否成立？','程度多高？'];return <div className="r-lesson">
 <Heading center size={70}><span className="r-red">三种问题，</span>分别怎么问？</Heading>
 {[565,1106].map(x=><i className="r-divider" key={x} style={{left:x,top:257,height:560}}/>)}
 {labels.map((v,i)=><Group show={beat>=i} key={v}><Text x={75+i*535} y={231} w={455} size={72} color="var(--r-red)" align="center" className="r-latin" weight={600}>{v}</Text><Text x={75+i*535} y={314} w={455} size={46} align="center" weight={600}>{questions[i]}</Text><Text x={87+i*535} y={392} w={450} size={29} line={1.45}>{[
 <>从预先给定的候选项中选择一个<br/>结果。适合分类、分流和行动选择。</>,<>判断一个明确条件是否成立，<br/>用 0 到 1 的概率表达结果。</>,<>先定义有顺序的等级，再评价一段<br/>内容处在什么程度。适合评分和排序。</>][i]}</Text><Art src="06-primitives" box={[65+i*535,718,486,122]}/><Text x={83+i*535} y={757} w={445} size={29} align="center">{['例：这条消息该交给哪个部门？','例：通知是否明确支持线上参加？','例：这条求助有多紧急？'][i]}</Text></Group>)}
 <Group><Text x={86} y={552} size={30}>输入</Text><Diagram><Ink d="M127 607C260 607 244 514 370 514" color="var(--r-blue)" arrow/><Ink d="M127 607H370" color="var(--r-red)" delay={300} arrow/><Ink d="M127 607C254 607 247 696 370 696" color="var(--r-green)" delay={600} arrow/><Ball x={127} y={607} color="#303331" r={16}/>{['var(--r-blue)','var(--r-red)','var(--r-green)'].map((color,i)=><Ball key={color} x={397} y={515+i*91} color={color} r={17}/>)}</Diagram>{['A','B','C'].map((s,i)=><Text key={s} x={429} y={490+i*91} size={42} className="r-latin">{s}</Text>)}</Group>
 <Group show={beat>=1}><Diagram><Ink d="M621 591H1049" width={2}/>{[621,714,836,959,1049].map(x=><path key={x} d={`M${x} 577V605`} stroke="var(--r-ink)" strokeWidth="2"/>)}<Ball x={621} y={591} color="#303331" r={11}/><Ball x={1049} y={591} color="#303331" r={11}/><Ball x={beat>=1?836:621} y={591} r={19} halo/></Diagram><Text x={613} y={611} size={37} className="r-latin">0</Text><Text x={1041} y={611} size={37} className="r-latin">1</Text><Text x={819} y={625} size={45} className="r-latin"><em>p</em></Text></Group>
 <Group show={beat>=2}><Art src="06-primitives" box={[1154,506,508,203]}/><Diagram><path d="M1358 558Q1374 510 1468 512" stroke="var(--r-red)" strokeWidth="2" strokeDasharray="10 8" markerEnd="url(#r-arrow)"/><Ball x={beat>=2?1356:1219} y={beat>=2?586:632} r={19}/></Diagram>{[0,1,2].map((n)=><Text key={n} x={1218+n*137} y={680} size={35} className="r-latin">{n}</Text>)}</Group>
 </div>}
