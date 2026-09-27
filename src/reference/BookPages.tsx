import {Art,Line,Text} from './primitives';

/** One persistent high-resolution paper surface. Focus never swaps in a second,
 * differently framed image: camera and all printed anchors interpolate together. */
export function BookPages({opening,beat,onNext}:{opening:boolean;beat:number;onNext:()=>void}){
 const focused=!opening&&beat>=2;
 const p=(normal:number,focus:number)=>focused?focus:normal;
 return <div className={`r-book-sequence ${opening?'is-closed':'is-open'} ${focused?'is-focused':''} ${!opening&&beat===1?'is-explaining':''} ${beat>=3?'is-concluding':''}`}>
  <div className="r-opening-copy" inert={!opening} aria-hidden={!opening}><Text x={68} y={240} size={160} className="r-latin" color="var(--r-red)" weight={400}>Jev</Text><Text x={273} y={302} size={88} weight={700}>的结构化判断</Text><Text x={70} y={448} size={47} weight={500}>从一个直观，认识一种决策模型</Text><button className="r-open-book-button" onClick={onNext}>翻开这本书 →</button></div>
  <div className="r-open-surface" aria-hidden={opening}>
   <div className="r-book-camera"><div className="r-book-plate"><Art src="02-book" box={[0,0,838,941]} className="r-left-book-art"/><Art src="02-book" box={[838,0,834,941]}/></div></div>
   <div className="r-book-left-copy"><div className="r-book-observation"/><Line x={280} y={215} w={45} color="var(--r-red)"/><Text x={274} y={235} size={59} weight={700}>两种<span className="r-red">思考方式</span></Text><Text x={272} y={343} size={34} weight={700}>快速判断</Text><Text x={271} y={393} size={24} line={1.35}>看到信息后，<br/>几乎立刻做出反应。</Text><i className="r-divider" style={{left:537,top:345,height:267}}/><Text x={565} y={337} size={34} weight={700}>仔细想一想</Text><Text x={566} y={383} size={24} line={1.35}>当需要更全面的决策时，<br/>我们会仔细思考。</Text></div>
   <div className="r-book-print"><Line x={p(905,454)} y={p(215,233)} w={p(45,69)} color="var(--r-red)"/>
    <Text x={p(905,454)} y={p(236,249)} size={p(58,100)} weight={700} w={p(570,900)}><span className="r-latin" style={{fontSize:p(65,112),fontWeight:500}}>Jev</span> 的结构化判断</Text>
    <Text x={p(905,454)} y={p(342,389)} size={p(30,48)} w={p(570,910)}>给它情况，问一个明确的问题。</Text>
    {['上下文','问题','判断'].map((label,i)=>{const x=p([905,1104,1296][i],[454,775,1090][i]),y=p(448,505),width=p(147,238);return <div key={label}><div className="r-book-box" style={{left:x,top:y,width,height:p(78,100)}}/><Text x={x} y={y+p(17,18)} w={width} size={p(30,42)} weight={600} align="center">{label}</Text><Text x={x-13} y={p(540,624)} w={width+26} size={p(23,31)} align="center" line={1.25}>{[<>提供相关信息<br/>与任务背景</>,<>明确需要回答<br/>的问题</>,<>返回选项、评分<br/>或概率</>][i]}</Text>{i<2&&<Text x={x+width+p(5,9)} y={y+p(10,17)} size={p(40,52)}>→</Text>}</div>})}
    <div className="r-book-type-line r-book-judgment-line" style={{left:p(1325,1137),top:p(509,583),width:p(94,153),height:p(3,5),background:'var(--r-red)'}}/>
    <Line x={p(910,454)} y={p(650,753)} w={p(533,881)}/>
    {['Choice','Noul','Score'].map((name,i)=><div key={name} className="r-book-types"><Text x={p(942+i*175,509+i*301)} y={p(669,772)} w={p(125,190)} size={p(34,46)} weight={600} align="center" className="r-latin">{name}</Text><div className="r-book-type-line" style={{left:p(953+i*176,527+i*296),top:p(716,829),width:p(98,150),background:['var(--r-blue)','var(--r-green)','var(--r-red)'][i]}}/></div>)}
   </div>
  </div>
  <div className="r-cover-surface" aria-hidden={!opening}><Art src="01-opening"/></div>
 </div>
}
