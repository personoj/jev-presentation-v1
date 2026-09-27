import type {Question} from '../../shared/types';
export const ALIGNMENT_QUESTION: Question = {type:'choice',instructions:'判断 transcript 是否基本按顺序朗读 candidate。允许一两个识别错字或少量漏字，但保留主要字词和顺序。仅话题相关、解释演示、临时补充、任意同义改述均选不匹配；没有对应候选也选不匹配。',criteria:{match:'基本按原文朗读，有少量局部转写差异',no_match:'插话、大幅改述、无对应稿件，或证据不足'}};
