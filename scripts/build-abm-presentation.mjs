import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('../public/data/experiments.json',import.meta.url));
const archive=JSON.parse(source),runs=archive.runs.filter(r=>r.seed===17&&r.mode==='jev'&&r.protocolVersion==='personas8-v1');
if(runs.length!==2||!runs.some(r=>r.policy)||!runs.some(r=>!r.policy))throw new Error('Complete paired Jev archive required');
const profiles=runs[0].snapshots[0].residents.map(r=>r.profile);
const output={schemaVersion:1,protocol:'personas8-v1',seed:17,source:'experiments.json',sourceSha256:createHash('sha256').update(source).digest('hex'),profiles,runs:runs.map(run=>({
 id:run.id,policy:run.policy,
 snapshots:run.snapshots.map(({history,...s})=>({...s,residents:s.residents.map(({profile,...r})=>r)})),
 rounds:run.state.history.map(h=>({...h,decisions:h.decisions.map(({input,...d})=>d),merchantDecisions:h.merchantDecisions?.map(({input,...d})=>d)})),
}))};
writeFileSync(new URL('../public/data/abm-presentation.json',import.meta.url),JSON.stringify(output));
console.log(`Prepared ${profiles.length} residents / ${runs.length} paired runs / 13 frames each.`);
