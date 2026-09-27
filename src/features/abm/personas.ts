/** Fictional experimental profiles. Coefficients are relative weights, not probabilities. */
export type ResidentProfile = {
  id: string;
  name: string;
  archetype: string;
  summary: string;
  traits: string[];
  motive: string;
  decisionStyle: string;
  priceSensitivity: number;
  distanceSensitivity: number;
  planningWeight: number;
  spriteIndex: number;
};

export const RESIDENT_PROFILES: ResidentProfile[] = [
  { id: 'R01', name: '林澈', archetype: '计划阅读者', summary: '按阅读清单购书，愿意等到计划中的时点。', traits: ['清单优先', '按期购买', '少受促销影响'], motive: '完成已经排好的阅读计划，比抢到折扣更重要。', decisionStyle: '先看是否接近购书计划，再比较书店与出行成本；未到计划时点倾向等待。', priceSensitivity: .8, distanceSensitivity: .8, planningWeight: 2.1, spriteIndex: 0 },
  { id: 'R02', name: '苏禾', archetype: '即兴文化爱好者', summary: '眼前有吸引力就行动，书与演出都想尝试。', traits: ['即时体验', '容易心动', '计划弹性大'], motive: '抓住当下有趣的文化体验，不愿把每次消费都排进日程。', decisionStyle: '重视当前偏好；折扣会增加吸引力，原定计划只作轻微参考。', priceSensitivity: .6, distanceSensitivity: .65, planningWeight: .25, spriteIndex: 1 },
  { id: 'R03', name: '周谨', archetype: '审慎藏书者', summary: '预算宽裕但选择谨慎，为合意的书接受路程。', traits: ['购书偏好强', '谨慎比较', '愿为兴趣远行'], motive: '补充真正想收藏的书，不因为便宜就购买缺少兴趣的东西。', decisionStyle: '优先考虑书籍需求与原有计划，出行距离影响较小，戏剧兴趣有限。', priceSensitivity: .65, distanceSensitivity: .4, planningWeight: 1.45, spriteIndex: 2 },
  { id: 'R04', name: '唐梨', archetype: '好奇探索者', summary: '喜欢走出熟悉的路线，乐于尝试书店和演出。', traits: ['跨门类兴趣', '乐于探索', '少受距离限制'], motive: '通过不同文化活动发现新的兴趣。', decisionStyle: '书籍与戏剧都值得考虑；不因稍远就放弃，也不严格拘泥原计划。', priceSensitivity: .75, distanceSensitivity: .45, planningWeight: .55, spriteIndex: 3 },
  { id: 'R05', name: '许砚', archetype: '预算敏感者', summary: '文化兴趣不低，但先算清实际要付多少钱。', traits: ['现金优先', '比较实付', '折扣敏感'], motive: '在有限预算内满足文化需求，给后续开销留出空间。', decisionStyle: '先比较券后实付与剩余预算；有兴趣也可能因价格暂缓购买。', priceSensitivity: 1.4, distanceSensitivity: 1.05, planningWeight: .85, spriteIndex: 4 },
  { id: 'R06', name: '顾宁', archetype: '戏剧社交者', summary: '更看重现场演出体验，愿为它留出预算。', traits: ['戏剧优先', '重视现场', '时间可协调'], motive: '获得能够与朋友讨论的现场文化体验；本实验未模拟朋友邀请。', decisionStyle: '优先满足戏剧偏好，书籍次之；愿意为合适的演出承担一定价格和路程。', priceSensitivity: .7, distanceSensitivity: .7, planningWeight: .7, spriteIndex: 5 },
  { id: 'R07', name: '叶岚', archetype: '务实就近者', summary: '希望消费嵌入日常路线，不愿专门折返。', traits: ['就近优先', '重视便利', '消费务实'], motive: '用较少的时间和开销满足稳定的阅读需求。', decisionStyle: '把路程负担当作重要成本，优先附近且价格合适的选择。', priceSensitivity: 1.05, distanceSensitivity: 1.85, planningWeight: 1.1, spriteIndex: 6 },
  { id: 'R08', name: '陈朔', archetype: '忙碌延后者', summary: '有文化兴趣，但空闲时段安排在较后几轮。', traits: ['时间紧张', '计划靠后', '不急于核销'], motive: '等忙碌阶段结束后再安排文化消费，不为用券打乱日程。', decisionStyle: '严格考虑靠后的计划时点，出行时间也较重要；消费券到期不意味着必须购买。', priceSensitivity: .9, distanceSensitivity: 1.35, planningWeight: 2.2, spriteIndex: 7 },
];

/** Same named people across seeds; only their numerical starting circumstances vary slightly. */
export const PERSONA_BASELINES = [
  { cash: 170, book: 88, theatre: 32, plannedRound: 4, travel: [7, 11, 12] },
  { cash: 140, book: 77, theatre: 83, plannedRound: 2, travel: [12, 8, 7] },
  { cash: 215, book: 95, theatre: 24, plannedRound: 5, travel: [11, 6, 14] },
  { cash: 145, book: 78, theatre: 79, plannedRound: 3, travel: [15, 10, 11] },
  { cash: 86, book: 86, theatre: 55, plannedRound: 3, travel: [7, 9, 13] },
  { cash: 185, book: 40, theatre: 96, plannedRound: 4, travel: [12, 9, 5] },
  { cash: 130, book: 83, theatre: 50, plannedRound: 2, travel: [3, 16, 17] },
  { cash: 180, book: 85, theatre: 72, plannedRound: 9, travel: [9, 14, 12] },
] as const;
