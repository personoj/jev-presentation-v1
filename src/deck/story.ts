import {openingContent} from './opening';
export type SceneId = 'opening'|'system-one'|'judgment'|'comparison'|'training'|'primitives'|'choice'|'noul'|'score'|'voice'|'economy'|'economy-person'|'economy-round'|'economy-compare';
export type Scene = {id:SceneId; section:string; title:string; subtitle:string; beats:string[]; note:string};
export const story:Scene[] = [
 {id:'opening',section:'组会汇报',title:openingContent.title,subtitle:openingContent.definition,beats:['从《思考，快与慢》中的系统一讲起'],note:openingContent.speech.join('\n\n')},
 {id:'system-one',section:'01 / 直观',title:'有些判断，来得很快。',subtitle:'先有一个直观，再认识 System 1。',beats:['翻开书，先看两种思考方式','看到涨价的直观，与计算月度预算','聚焦右页：给它情况，问一个明确的问题','Choice、Noul、Score：三种提问方式'],note:'书本是概念导读，不是原书内页。熟悉的商品涨价时，我们可能迅速觉得贵；安排月度预算则需要逐项比较。System 1 与 System 2 是认知类比，不是对 Jev 内部架构的描述。Jev 借用 System One 命名，强调快速、聚焦的判断。'},
 {id:'judgment',section:'02 / 认识 Jev',title:'Jev 是怎么运作的？',subtitle:'我们提供相关背景，明确要判断的问题，并设定输出方式；Jev 根据这些信息，给出对应的判断结果。',beats:['先告诉它，发生了什么','再明确，要判断什么','得到结果，交给程序继续处理'],note:'用付款后订单未更新的消息说明输入、问题和输出。我们负责设计，Jev 负责判断。我们定义背景、问题和输出方式，程序根据判断结果安排后续操作。本页是解释流程的示意，没有发出模型请求。'},
 {id:'comparison',section:'03 / 核心区别',title:'生成一段回答，或返回一个判断。',subtitle:'同一条消息，两种输出方式。',beats:['同一条消息，两种输出方式','常见自回归语言模型：逐个生成 token','Jev：返回预先定义的答案与概率','官方演示对照：完成时间与调用费用'],note:'前三步是输出方式的示意，不表达相对速度。token 是文字片段，不一定是一个完整词；Transformer 是架构概念，不等于自回归。LLM 也能输出结构化内容。最后的弹窗采用 TypeSafe 官方发布的短输入对照演示，LLM 为默认推理的 GPT-5.6 Terra；它不是本页订单消息的现场测量。动画等比例加速，时间条使用相同刻度。差异仅针对这次演示，实际表现受任务与网络影响。'},
 {id:'training',section:'03 / 核心区别',title:'训练目标，也有不同。',subtitle:'希望模型做好什么，就用什么信号训练它。',beats:['从已有的语言理解能力出发','RLHF：学习人类更偏好的回答','RLCD：学习决策，并在许多次判断中检验概率'],note:'按 TypeSafe 官方定位介绍 RLCD，即 reinforcement learning for calibrated decisions。RLHF 是人类反馈强化学习，关注人类偏好的输出。图中十个点是校准的教学示意：许多标为 80% 的预测，若校准良好，其事件发生比例应接近 80%，不是一次判断必然正确，也不是 Jev 实测。这里省略 RLVR 和训练算法细节。'},
 {id:'primitives',section:'04 / 三种提问方式',title:'Jev 能回答三类问题。',subtitle:'选哪个？是否成立？程度多高？',beats:['Choice · 从给定的选项里选择','Noul · 一个条件成立的概率','Score · 按定义好的等级评分'],note:'先讲中文，再读英文名称。Choice 选择候选项；Noul 表示布尔判断的概率；Score 在定义好的有序等级上给出分数。三个动画均为概念示意，下面各给一个独立例子。'},
 {id:'choice',section:'05 / 简单应用 · Choice',title:'这条消息，应该交给谁？',subtitle:'给校园消息找到合适的去向。',beats:['读一条来自学生的消息','在三个服务部门中选择','把消息送进对应的处理队列'],note:'默认先播放示意结果，方便讲解。换例子会重置结果。点击“用 Jev 判断”才发送真实请求；真实结果不必与示意一致。返回的选项决定消息去向，概率不当作正确率。'},
 {id:'noul',section:'05 / 简单应用 · Noul',title:'这场讲座，可以线上参加吗？',subtitle:'把一个明确的问题，变成可读取的概率。',beats:['读一则活动通知','问：通知是否明确支持线上参加？','看结果，再决定怎样标注活动'],note:'本页询问通知是否明确支持线上参加，不是预测活动最终是否会直播。没有提到直播的通知，不等于确认没有直播；因此程序标签使用“未明确”。强调句是预设讲解标注，不是模型返回的推理。示意概率与真实调用严格区分。'},
 {id:'score',section:'05 / 简单应用 · Score',title:'先处理哪一条求助？',subtitle:'先定义紧急程度，再用分数安排顺序。',beats:['三条消息，需要不同程度的关注','用相同的标准，分别评分','按分数排序，安排处理顺序'],note:'等级为 0 普通咨询、1 影响使用、2 持续损失。示意为 0.2、1.1、1.9，不是公式计算或真实结果。真实请求会同时评价三条消息，按实际分数排序。此页说明工作队列，不用于真实安全事件分诊。'},
 {id:'voice',section:'06 / 连续应用',title:'Jev 的具体应用',subtitle:'按稿朗读时，文字逐步高亮；临时插话时停住，回到原文后继续跟随。',beats:['声音 → 文字 → 对齐与判断 → 稿件位置'],note:'先按稿读第一句，再插话，最后回到原文。声音由千问 ASR 转成文字，Jev 仅接收文本。精确对齐由程序处理，存在局部差异时由 Jev 辅助检查。下面三个快捷演示使用固定转写，不采集声音；需要真实语音时开启麦克风。'},
 {id:'economy',section:'07 / 主体模拟',title:'让 Jev 为小镇居民做选择',subtitle:'八位居民各自行动，观察这些选择怎样改变小镇。',beats:['认识八位居民、三家商店和文化消费券'],note:'ABM 从每个主体的选择观察整体变化。八位居民是虚构的实验人物，各有预算、偏好与计划。点击地图上的任意居民，或打开居民选择器，后续页面会沿用该居民。'},
 {id:'economy-person',section:'07 / 主体模拟',title:'这一轮，他会怎么选？',subtitle:'把个人情况交给 Jev，从四个行动中选择一个。',beats:['居民的背景、余额与消费券','Jev 给出四个行动的概率','程序检查条件，完成交易或保留预算'],note:'默认展示第17组保存的全体 Jev 实验。人物和轮次可以切换。概率来自保存请求；约束检查直接等待时没有模型概率。意向不等同成交，交易结果以程序结算为准。金额为模拟货币。'},
 {id:'economy-round',section:'07 / 主体模拟',title:'八个人的选择，让小镇运转起来',subtitle:'居民作出选择，交易逐笔发生，小镇进入下一轮。',beats:['从相同的初始状态出发','推进轮次，观察交易与消费券核销'],note:'地图中的八位居民均可选择。点击下一轮或轮次刻度，可查看12轮保存轨迹；连续回放可暂停。右侧是当轮成交、交易额与核销，不是累计值。消费券在第6轮结束后到期。'},
 {id:'economy-compare',section:'07 / 主体模拟',title:'发放消费券，改变了什么？',subtitle:'同一组居民、相同的初始条件，对比两种情景。',beats:['相同居民、相同初始条件','同步回放有券与无券两组实验','比较最终结果与差异出现的轮次'],note:'第17组保存的 Jev 配对实验：无券9件、交易额640；有券11件、交易额770、核销210。第4轮累计相差1件，第9轮相差2件。这是本组模拟结果，不是现实政策效果的估计。实验台保留其他种子、自由实验和真实调用。'}
];

export const resources = [
 ['Jev 与 LLM 的官方对照演示','https://typesafe.ai/'],
 ['发布演示的任务与推理设置','https://typesafe.ai/blog/introducing-system-one-models-and-jev'],
 ['Jev 当前价格与模型信息','https://docs.typesafe.ai/models'],
 ['System One 与 Jev','https://docs.typesafe.ai/concepts/system-one'],
 ['训练目标：RLHF 与 RLCD','https://docs.typesafe.ai/introduction/machine-learning-primer'],
 ['Choice、Noul、Score','https://docs.typesafe.ai/primitives'],
 ['概率与置信度','https://docs.typesafe.ai/confidence'],
 ['Attention Is All You Need','https://arxiv.org/abs/1706.03762']
];

export function readLocation(hash:string){
 const [raw,part]=hash.replace(/^#/,'').split('/');
 const aliases:Record<string,string>={round:'economy-round',compare:'economy-compare',uncertainty:'training',workflow:'judgment',text:'score',discussion:'economy'};
 const index=Math.max(0,story.findIndex(s=>s.id===(aliases[raw]??raw)));
 const beat=Math.max(0,Math.min(story[index].beats.length-1,Math.floor(Number(part))||0));
 return {index,beat};
}
