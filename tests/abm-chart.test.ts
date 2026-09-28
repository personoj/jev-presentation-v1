import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHART,chartScale,stepTrace} from '../src/reference/abm-chart';
test('both series share a zero origin and a non-truncated common scale',()=>{
 const a=[0,1,2,3],b=[0,1,3,5],max=chartScale([a,b]);
 assert.equal(max,5);assert.deepEqual(stepTrace(a,0,max).end,stepTrace(b,0,max).end);
 assert.equal(stepTrace(a,0,max).end.y,CHART.bottom);assert.equal(stepTrace(b,3,max).end.y,CHART.top);
});
test('growth follows orthogonal steps, stays bounded and settles on the actual count',()=>{
 const values=[0,1,3,4,6],max=chartScale([values]);
 for(let r=0;r<=400;r++){const trace=stepTrace(values,r/100,max);for(let i=0;i<trace.points.length;i++){
  const p=trace.points[i];assert.ok(p.x>=CHART.left&&p.x<=CHART.right);assert.ok(p.y>=CHART.top&&p.y<=CHART.bottom);
  if(i){const previous=trace.points[i-1];assert.ok(p.x===previous.x||p.y===previous.y,'no diagonal shortcut between rounds')}
 }}
 assert.deepEqual(stepTrace(values,99,max).end,stepTrace(values,4,max).end);
 assert.deepEqual(stepTrace(values,-1,max).end,stepTrace(values,0,max).end);
});
