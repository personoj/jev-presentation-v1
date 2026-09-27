export type SceneId = 'opening'|'system-one'|'judgment'|'comparison'|'training'|'primitives'|'choice'|'noul'|'score'|'voice'|'economy';
export type Scene = {id:SceneId; section:string; title:string; subtitle:string; beats:string[]; note:string};
export const story:Scene[] = [
 {id:'opening',section:'从一个直观开始',title:'让软件，也能做判断。',subtitle:'认识 Jev，一种面向软件的决策模型。',beats:['从《思考，快与慢》说起'],note:'今天介绍 Jev。先从一个日常判断说起，再比较它与常见生成式语言模型的工作方式，最后看三个小应用和两个完整演示。这里不要求大家有机器学习基础。'},
 {id:'system-one',section:'01 / 直观',title:'有些判断，来得很快。',subtitle:'先有一个直观，再认识 System 1。',beats:['翻开《思考，快与慢》','看到价格，马上觉得贵了','算一算，这个月一共要花多少','Jev 借用的是快速、聚焦的判断这个直观'],note:'书本是概念导读，不是原书内页。熟悉的商品涨价时，我们可能迅速觉得贵；安排月度预算则需要逐项比较。System 1 与 System 2 是认知类比，不是对 Jev 内部架构的描述。Jev 借用 System One 命名，强调快速、聚焦的判断。'},
 {id:'judgment',section:'02 / 认识 Jev',title:'给它情况，问一个明确的问题。',subtitle:'把自然语言，变成程序可以使用的判断。',beats:['先告诉它，发生了什么','再明确，要判断什么','得到结果，交给程序继续处理'],note:'用付款后订单未更新的消息说明输入、问题和输出。选项由我们定义，模型负责判断，程序负责后续操作。本页是解释流程的示意，没有发出模型请求。'},
 {id:'comparison',section:'03 / 核心区别',title:'生成一段回答，或返回一个判断。',subtitle:'同一条消息，两种输出方式。',beats:['常见自回归语言模型：逐个生成 token','Jev：返回预先定义的答案与概率','软件可以直接读取这个结果'],note:'左侧示意常见自回归生成：token 是文字片段，不一定是一个完整词。右侧只展示官方已公开的输入输出方式，不推断 Jev 未公开的内部架构。Transformer 是架构概念，不等于自回归。LLM 也能输出结构化内容；Jev 的区别还在于专门的训练目标。本页不表达相对运行速度。'},
 {id:'training',section:'03 / 核心区别',title:'训练目标，也有不同。',subtitle:'希望模型做好什么，就用什么信号训练它。',beats:['RLHF：学习人类更偏好的回答','RLCD：学习决策，以及与结果相符的概率','概率有没有意义，要在许多次判断中检验'],note:'按 TypeSafe 官方定位介绍 RLCD，即 reinforcement learning for calibrated decisions。RLHF 是人类反馈强化学习，关注人类偏好的输出。图中十个点是校准的教学示意：许多标为 80% 的预测，若校准良好，其事件发生比例应接近 80%，不是一次判断必然正确，也不是 Jev 实测。这里省略 RLVR 和训练算法细节。'},
 {id:'primitives',section:'04 / 三种提问方式',title:'Jev 能回答三类问题。',subtitle:'选哪个？是否成立？程度多高？',beats:['Choice · 从给定的选项里选择','Noul · 一个条件成立的概率','Score · 按定义好的等级评分'],note:'先讲中文，再读英文名称。Choice 选择候选项；Noul 表示布尔判断的概率；Score 在定义好的有序等级上给出分数。三个动画均为概念示意，下面各给一个独立例子。'},
 {id:'choice',section:'05 / 简单应用 · Choice',title:'这条消息，应该交给谁？',subtitle:'给校园消息找到合适的去向。',beats:['读一条来自学生的消息','在三个服务部门中选择','把消息送进对应的处理队列'],note:'默认先播放示意结果，方便讲解。换例子会重置结果。点击“用 Jev 判断”才发送真实请求；真实结果不必与示意一致。返回的选项决定消息去向，概率不当作正确率。'},
 {id:'noul',section:'05 / 简单应用 · Noul',title:'这场讲座，可以线上参加吗？',subtitle:'把一个明确的问题，变成可读取的概率。',beats:['读一则活动通知','问：通知是否明确支持线上参加？','看结果，再决定怎样标注活动'],note:'本页询问通知是否明确支持线上参加，不是预测活动最终是否会直播。没有提到直播的通知，不等于确认没有直播；因此程序标签使用“未明确”。强调句是预设讲解标注，不是模型返回的推理。示意概率与真实调用严格区分。'},
 {id:'score',section:'05 / 简单应用 · Score',title:'先处理哪一条求助？',subtitle:'先定义紧急程度，再用分数安排顺序。',beats:['三条消息，需要不同程度的关注','用相同的标准，分别评分','按分数排序，安排处理顺序'],note:'等级为 0 普通咨询、1 影响使用、2 持续损失。示意为 0.2、1.1、1.9，不是公式计算或真实结果。真实请求会同时评价三条消息，按实际分数排序。此页说明工作队列，不用于真实安全事件分诊。'},
 {id:'voice',section:'06 / 连续应用',title:'念稿时跟随，插话时停住。',subtitle:'把一个小判断，放进连续运行的程序。',beats:['声音 → 文字 → 对齐与判断 → 稿件位置'],note:'先按稿读第一句，再插话，最后回到原文。声音由千问 ASR 转成文字，Jev 仅接收文本。精确对齐由程序处理，存在局部差异时由 Jev 辅助检查。下面三个快捷演示使用固定转写，不采集声音；需要真实语音时开启麦克风。'},
 {id:'economy',section:'07 / 主体模拟',title:'当判断进入一座小镇。',subtitle:'八位居民，同一张消费券，不同的打算。',beats:['认识居民，再观察他们的选择'],note:'保留现有八人小镇。先介绍居民差异，再运行同一政策。自由实验、政策对照、真实调用与保存轨迹仍沿用原机制。用单人 Jev 按钮时，其余居民按规则运行，不等同全体 Jev 实验。'}
];

export const resources = [
 ['System One 与 Jev','https://docs.typesafe.ai/concepts/system-one'],
 ['训练目标：RLHF 与 RLCD','https://docs.typesafe.ai/introduction/machine-learning-primer'],
 ['Choice、Noul、Score','https://docs.typesafe.ai/primitives'],
 ['概率与置信度','https://docs.typesafe.ai/confidence'],
 ['Attention Is All You Need','https://arxiv.org/abs/1706.03762']
];

export function readLocation(hash:string){
 const [raw,part]=hash.replace(/^#/,'').split('/');
 const aliases:Record<string,string>={round:'economy',compare:'economy',uncertainty:'training',workflow:'judgment',text:'score',discussion:'economy'};
 const index=Math.max(0,story.findIndex(s=>s.id===(aliases[raw]??raw)));
 const beat=Math.max(0,Math.min(story[index].beats.length-1,Math.floor(Number(part))||0));
 return {index,beat};
}
