export const CHART={left:62,right:950,top:26,bottom:193};
export function chartScale(series:number[][]){return Math.max(5,Math.ceil(Math.max(...series.flat())/5)*5)}
export function stepTrace(values:number[],position:number,maximum:number){
 const time=Math.min(values.length-1,Math.max(0,position)),round=Math.floor(time),fraction=time-round;
 const x=(r:number)=>CHART.left+(CHART.right-CHART.left)*r/(values.length-1);
 const y=(v:number)=>CHART.bottom-(CHART.bottom-CHART.top)*v/maximum;
 const points=[{x:x(0),y:y(values[0])}];
 for(let i=1;i<=round;i++){points.push({x:x(i),y:y(values[i-1])},{x:x(i),y:y(values[i])})}
 if(fraction&&round<values.length-1){const movingX=x(round+Math.min(1,fraction/.65));const value=values[round]+(values[round+1]-values[round])*Math.max(0,(fraction-.65)/.35);points.push({x:movingX,y:y(values[round])},{x:movingX,y:y(value)})}
 return {points,end:points.at(-1)!,path:points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')};
}
