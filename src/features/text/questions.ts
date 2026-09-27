import type {Question} from '../../shared/types';
export const POLICY = '城市拟发放文化消费券，在参与试点的书店和剧场抵扣部分消费。每位符合条件的居民获得一张券，设有使用期限。参与商家按实际交易申请结算。';
export const OPINIONS = [
  {id:'A',theme:'原有计划',text:'我原本就准备买这本书，有券正好省一些。',variant:'这本书本来就在我的购买清单上，消费券能让我少花一点钱。'},
  {id:'B',theme:'支持与距离',text:'我支持这个办法，但合作书店离家太远，近期不会去。',variant:'发消费券是好事，不过我家附近没有合作书店，这段时间我不会去买。'},
  {id:'C',theme:'条件性参与',text:'如果能用于周末演出，我会考虑第一次去看话剧。',variant:'要是周末的话剧也能用券，我可能会第一次买票去看。'},
  {id:'D',theme:'参与机会',text:'只在几家大店使用不太公平，希望社区书店也能参加。',variant:'合作商家都集中在少数大店，我觉得不公平，社区书店也应该有机会。'},
];
export const stanceLabels: Record<string,string>={support:'支持',oppose:'反对',mixed:'混合',not_expressed:'未表达'};
export const TEXT_QUESTIONS: Record<string,Question> = {
  stance:{type:'choice',instructions:'只根据 opinion 判断说话者对 policy 中发放文化消费券政策的总体立场。不要把参与意愿、对某个执行细节的顾虑直接等同总体反对。未明确表达总体立场且无法确定时选未表达。',criteria:{support:'明确支持或肯定发券政策',oppose:'明确反对或否定发券政策',mixed:'明确同时表达对政策的支持与反对',not_expressed:'只谈个人计划、条件或细节，未明确表达总体立场'}},
  distance:{type:'noul',instructions:'opinion 是否表达了因距离、路程或出行可达性而产生的顾虑？只依据明确表达，不从政策设定推测。'},
  fairness:{type:'noul',instructions:'opinion 是否表达了公平或参与机会方面的顾虑？只依据原文。'},
  original_plan:{type:'noul',instructions:'opinion 是否明确表明，在发券之前已经存在相应的文化消费计划？不能把有券后考虑参加算作原有计划。'},
  intention_present:{type:'noul',instructions:'opinion 是否明确表达了说话者自己的消费或参加活动意愿，包括不参加、条件性的考虑或明确计划？只评价商家资格或公平性，不算表达自身参与意愿。'},
  intention:{type:'score',instructions:'假设 opinion 表达了个人参与意愿，按原文表达评估近期使用消费券购书或参加演出的意愿。条件性的考虑不能当成明确参与计划。这个分数是文本意愿的等级，不是真实行为概率。未表达时本题结果由程序丢弃。',criteria:['明确不打算参与或近期不会参加','尚未决定，提出条件，或表示会考虑','已有明确消费计划或明确表示会参加']},
};

