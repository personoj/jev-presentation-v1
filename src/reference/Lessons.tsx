import {Art,Diagram,Group,Ink,Line,Text} from './primitives';

export function Judgment({beat}:{beat:number}){return <div className="r-lesson">
 <Text x={70} y={104} size={88} weight={700}><span className="r-latin" style={{fontSize:102}}>Jev</span><span className="r-red"> 是什么？</span></Text>
 <Text x={73} y={219} size={37} weight={600} w={1500}>它理解我们描述的情况，回答一个范围明确的问题，再把结果交给程序。</Text>
 <Group><Art src="03-judgment-clean" box={[85,285,490,376]}/><Text x={157} y={398} size={36} weight={600} line={1.38}>已经付款，<br/>订单仍显示未支付。</Text><Line x={160} y={528} w={52} color="var(--r-red)"/></Group>
 <Group show={beat>=1}><Art src="03-judgment-clean" box={[585,273,535,390]}/><Text x={692} y={445} w={285} size={36} weight={600} align="center">该交给谁？</Text><Text x={625} y={538} w={140} size={27} align="center" color="#fff7ed">订单服务</Text><Text x={785} y={538} w={140} size={27} align="center">商品咨询</Text><Text x={945} y={538} w={100} size={27} align="center">其他</Text></Group>
 <Group show={beat>=2}><Art src="03-judgment-clean" box={[1162,268,510,410]}/><Text x={1276} y={431} w={215} size={35} align="center" color="#fff7ed">订单服务</Text><Text x={1272} y={534} w={174} size={31} align="center">处理</Text></Group>
 <Diagram><Ink d="M491 447C559 424 600 478 675 477" color="var(--r-blue)" show={beat>=1} arrow/><Ink d="M975 475C1072 471 1093 416 1217 462" color="var(--r-red)" show={beat>=2} arrow/></Diagram>
 <Group><Text x={121} y={620} size={40} weight={600} color="var(--r-blue)">提供情况</Text><Line x={310} y={652} w={184}/><Text x={121} y={682} size={31} line={1.25}>把与任务有关的文字交给模型，<br/>例如一条用户留言或一则通知。</Text></Group>
 <Group show={beat>=1}><Text x={649} y={620} size={40} weight={600} color="var(--r-red)">定义问题</Text><Line x={835} y={652} w={188}/><Text x={649} y={682} size={31} line={1.25}>说明要判断什么，并提前给出<br/>答案范围，减少含糊的解释。</Text></Group>
 <Group show={beat>=2}><Text x={1179} y={620} size={40} weight={600} color="var(--r-green)">读取结果</Text><Line x={1370} y={652} w={181}/><Text x={1179} y={682} size={31} line={1.25}>程序拿到选项、概率或分数，<br/>就可以安排后续操作。</Text><Art src="03-judgment-clean" box={[470,770,760,95]}/><Text x={545} y={788} w={625} size={39} weight={600} align="center"><span className="r-latin">Jev</span> 负责<span className="r-red">判断</span>，程序负责<span className="r-red">执行</span>。</Text><Line x={285} y={820} w={211}/><Line x={1202} y={820} w={239}/></Group>
 </div>}
