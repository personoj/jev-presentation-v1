export const DEFAULT_SCRIPT = '我们使用语音识别模型，把声音转换成文字。程序结合稿件中的前后内容，判断当前读到了什么位置。识别结果存在少量差异时，仍然可以尝试继续跟随。临时插话结束以后，再回到原文。';

export function normalized(text: string) {
  const chars: string[] = [], positions: number[] = [];
  for (let i = 0; i < text.length; i++) if (/[\p{L}\p{N}]/u.test(text[i])) { chars.push(text[i].toLowerCase()); positions.push(i); }
  return {text: chars.join(''), positions};
}
// Small, explicit pronunciation confusions. This is not a general phonetic recognizer.
const soundGroups = ['的地得', '在再', '是事式试', '以已', '做作', '音因阴', '义意易', '识时实', '跟根', '型形'];
const substitution = (a: string, b: string) => a === b ? 0 : soundGroups.some(g => g.includes(a) && g.includes(b)) ? 0.45 : 1;
export type Candidate = {start: number; end: number; text: string; similarity: number; exact: boolean; distance: number};
export function findCandidate(script: string, heard: string, anchor: number): Candidate | null {
  const source = normalized(script), query = normalized(heard).text;
  if (query.length < 4 || query.length > 350) return null;
  const a = source.positions.findIndex(p => p >= anchor);
  const center = a < 0 ? source.text.length : a;
  const low = Math.max(0, center - 45), high = Math.min(source.text.length, center + 150);
  const target = source.text.slice(low, high), m = query.length, n = target.length;
  let prev = new Float64Array(n + 1), starts = Int32Array.from({length: n + 1}, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const row = new Float64Array(n + 1), nextStarts = new Int32Array(n + 1); row[0] = i;
    for (let j = 1; j <= n; j++) {
      const costs = [prev[j - 1] + substitution(query[i - 1], target[j - 1]), prev[j] + 1, row[j - 1] + 1];
      const best = costs[0] <= costs[1] && costs[0] <= costs[2] ? 0 : costs[1] <= costs[2] ? 1 : 2;
      row[j] = costs[best]; nextStarts[j] = best === 0 ? starts[j - 1] : best === 1 ? starts[j] : nextStarts[j - 1];
    }
    prev = row; starts = nextStarts;
  }
  let best: Candidate | null = null, bestRank = -Infinity;
  for (let j = 1; j <= n; j++) {
    const startIndex = low + starts[j], endIndex = low + j;
    const length = endIndex - startIndex;
    if (length < Math.max(4, m * 0.65)) continue;
    const similarity = Math.max(0, 1 - prev[j] / Math.max(m, length));
    const start = source.positions[startIndex], end = source.positions[endIndex - 1] + 1;
    const distance = Math.abs(start - anchor);
    const rank = similarity - Math.min(distance, 150) * 0.0008;
    if (rank > bestRank) { bestRank = rank; best = {start, end, text: script.slice(start, end), similarity, exact: prev[j] === 0, distance}; }
  }
  return best;
}
export type MatchDecision = 'short' | 'exact' | 'review' | 'pause';
export function classifyCandidate(candidate: Candidate | null, heard: string): MatchDecision {
  if (normalized(heard).text.length < 4) return 'short';
  if (!candidate || candidate.similarity < 0.6) return 'pause';
  if (candidate.exact && normalized(heard).text.length >= 6 && candidate.distance <= 60) return 'exact';
  return 'review';
}
export const commitPosition = (confirmed: number, candidateEnd: number) => Math.max(confirmed, candidateEnd);
export function acceptJudgment(candidate: Candidate | null, choice?: string, probability?: number) {
  if (!candidate || candidate.similarity < 0.6 || choice !== 'match' || probability === undefined) return false;
  // Strong ordered lexical evidence permits a lower semantic gate. Both are explicit demo parameters.
  return candidate.similarity >= 0.9 ? probability > 0.5 : probability >= 0.8;
}
export class Freshness {
  private version = 0;
  next() { return ++this.version; }
  isCurrent(version: number) { return version === this.version; }
}

