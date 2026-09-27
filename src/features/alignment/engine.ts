export const DEFAULT_SCRIPT = '我们使用语音识别模型，把声音转换成文字。程序结合稿件中的前后内容，判断当前读到了什么位置。识别结果存在少量差异时，仍然可以尝试继续跟随。临时插话结束以后，再回到原文。';

export function normalized(text: string) {
  const chars: string[] = [], positions: number[] = [];
  for (let i = 0; i < text.length; i++) if (/[\p{L}\p{N}]/u.test(text[i])) { chars.push(text[i].toLowerCase()); positions.push(i); }
  return {text: chars.join(''), positions};
}
// Small, explicit pronunciation confusions. This is not a general phonetic recognizer.
const soundGroups = ['的地得', '在再', '是事式试', '以已', '做作', '音因阴', '义意易', '识时实', '跟根', '型形'];
const substitution = (a: string, b: string) => a === b ? 0 : soundGroups.some(g => g.includes(a) && g.includes(b)) ? 0.45 : 1;
export type Candidate = {start: number; end: number; text: string; similarity: number; exact: boolean; distance: number;semantic?:boolean};
/** Offer only the expected nearby clause for semantic review. This is a
 * hypothesis for Jev, never lexical evidence or automatic permission to move. */
export function findSemanticCandidate(script:string,heard:string,anchor:number):Candidate|null{
  const length=normalized(heard).text.length;if(length<6||length>120)return null;
  const positions=normalized(script).positions,start=positions.find(p=>p>=anchor);if(start===undefined)return null;
  const candidates:Candidate[]=[];
  for(let end=start+1;end<=Math.min(script.length,start+120);end++){
    if(end<script.length&&!/[，。！？；、\n,.!?;]/.test(script[end]))continue;
    const text=script.slice(start,end),size=normalized(text).text.length;
    if(size>=Math.max(4,length*.55)&&size<=length*1.65)candidates.push({start,end,text,similarity:0,exact:false,distance:start-anchor,semantic:true});
    if(size>length*1.65)break;
  }
  return candidates.sort((a,b)=>Math.abs(normalized(a.text).text.length-length)-Math.abs(normalized(b.text).text.length-length))[0]??null;
}
/** Recover the words being spoken now, including after an aside inside the
 * same ASR segment. Only a unique, substantial exact suffix can relocate. */
export function findExactReadingTail(script:string,heard:string,anchor:number):Candidate|null{
  const source=normalized(script),query=normalized(heard).text;
  for(let length=Math.min(80,query.length);length>=6;length--){
    const tail=query.slice(-length),index=source.text.indexOf(tail);
    if(index<0||source.text.indexOf(tail,index+1)>=0)continue;
    const start=source.positions[index],end=source.positions[index+length-1]+1;
    return {start,end,text:script.slice(start,end),exact:true,similarity:1,distance:Math.abs(start-anchor)};
  }
  return null;
}
/** A unique short phrase is enough to locate a deliberate reread. Use a whole
 * short utterance, a repeated utterance, or newly appended words, not an
 * arbitrary three-character suffix of unrelated speech. */
export function findUniqueShortPhrase(script:string,heard:string,previous:string,anchor:number):Candidate|null{
  const source=normalized(script),query=normalized(heard).text,old=normalized(previous).text;
  if(old.startsWith(query)&&query.length<old.length)return null; // ASR retraction
  const clause=normalized(heard.split(/[，。！？；\n,.!?;]/).filter(s=>normalized(s).text).at(-1)||'').text;
  const appended=old&&query.startsWith(old)?query.slice(old.length):'';
  for(let size=Math.min(5,query.length);size>=3;size--){
    const phrase=query.slice(-size),repeated=query.length%size===0&&phrase.repeat(query.length/size)===query;
    if(query!==phrase&&!repeated&&clause!==phrase&&appended!==phrase)continue;
    const index=source.text.indexOf(phrase);
    if(index<0||source.text.indexOf(phrase,index+1)>=0)continue;
    const start=source.positions[index],end=source.positions[index+size-1]+1;
    return {start,end,text:script.slice(start,end),exact:true,similarity:1,distance:Math.abs(start-anchor)};
  }
  return null;
}
/** A two/three-character preview is allowed only at the expected reading head,
 * never by finding a coincidental short word elsewhere in the manuscript. */
export function findShortPreview(script:string,heard:string,anchor:number):Candidate|null{
  const source=normalized(script),query=normalized(heard).text;
  if(query.length<2||query.length>=4)return null;
  const index=source.positions.findIndex(p=>p>=anchor);if(index<0)return null;
  if(!source.text.startsWith(query,index))return null;
  const start=source.positions[index],end=source.positions[index+query.length-1]+1;
  return {start,end,text:script.slice(start,end),exact:true,similarity:1,distance:Math.abs(start-anchor)};
}
export function findCandidate(script: string, heard: string, anchor: number): Candidate | null {
  const source = normalized(script), query = normalized(heard).text;
  if (query.length < 4 || query.length > 350) return null;
  const a = source.positions.findIndex(p => p >= anchor);
  const center = a < 0 ? source.text.length : a;
  const low = Math.max(0, center - 45), high = Math.min(source.text.length, center + Math.max(150,query.length+24));
  const target = source.text.slice(low, high), m = query.length, n = target.length;
  // Most streaming revisions are exact prefixes; avoid the edit-distance matrix.
  let exactIndex=target.indexOf(query),nearest=-1,distance=Infinity;
  while(exactIndex>=0){const d=Math.abs(source.positions[low+exactIndex]-anchor);if(d<distance){nearest=exactIndex;distance=d}exactIndex=target.indexOf(query,exactIndex+1)}
  if(nearest>=0&&(distance===0||(distance<=4&&m<=100))){const start=source.positions[low+nearest],end=source.positions[low+nearest+m-1]+1;return {start,end,text:script.slice(start,end),similarity:1,exact:true,distance}}
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
  if(candidate?.semantic)return 'review';
  if (!candidate || candidate.similarity < 0.6) return 'pause';
  if (candidate.exact && normalized(heard).text.length >= 6 && candidate.distance <= 60) return 'exact';
  return 'review';
}
export const commitPosition = (confirmed: number, candidateEnd: number) => Math.max(confirmed, candidateEnd);
export function acceptJudgment(candidate: Candidate | null, choice?: string, probability?: number) {
  if(candidate?.semantic)return choice==='match'&&probability!==undefined&&probability>=.7;
  if (!candidate || candidate.similarity < 0.6 || choice !== 'match' || probability === undefined) return false;
  // Strong ordered lexical evidence permits a lower semantic gate. Both are explicit demo parameters.
  return candidate.similarity >= 0.9 ? probability > 0.5 : probability >= 0.8;
}
export class Freshness {
  private version = 0;
  next() { return ++this.version; }
  isCurrent(version: number) { return version === this.version; }
}

