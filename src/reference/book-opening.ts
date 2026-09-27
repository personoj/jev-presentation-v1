export type Point=readonly[number,number];
export type Quad=readonly[Point,Point,Point,Point];
export const BOOK_OPEN_MS=1800;
// Measured page corners in the existing 1672 x 941 artwork; keep the final
// spread calibration identical to the approved layout.
export const CLOSED_COVER:Quad=[[835,151],[1290,40],[1542,655],[1035,790]];
const plate=([x,y]:Point):Point=>[30+.964*x,17+.972*y];
const unplate=([x,y]:Point):Point=>[(x-30)/.964,(y-17)/.972];
const LEFT_ART:Quad=[[202,111],[838,124],[841,815],[92,808]];
export const RIGHT_PAGE:Quad=([[838,124],[1468,111],[1555,808],[841,815]] as const).map(plate) as unknown as Quad;
export const LEFT_PAGE:Quad=([[202,111],[838,124],[841,815],[92,808]] as const).map(plate) as unknown as Quad;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const bookEase=(t:number)=>t*t*(3-2*t);

/** Project an existing image plane, without resampling or replacing its art. */
export function homography(source:Quad,target:Quad){
 const rows:number[][]=[];
 source.forEach(([x,y],i)=>{const [u,v]=target[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v])});
 for(let col=0;col<8;col++){
  let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(rows[row][col])>Math.abs(rows[pivot][col]))pivot=row;
  [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
  const divisor=rows[col][col];if(Math.abs(divisor)<1e-10)throw Error('Degenerate book plane');
  for(let j=col;j<=8;j++)rows[col][j]/=divisor;
  for(let row=0;row<8;row++){if(row===col)continue;const amount=rows[row][col];for(let j=col;j<=8;j++)rows[row][j]-=amount*rows[col][j]}
 }
 return [...rows.map(r=>r[8]),1];
}
export function project(h:number[],[x,y]:Point):Point{const w=h[6]*x+h[7]*y+1;return[(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w]}
export function matrix(h:number[]){return `matrix3d(${[h[0],h[3],0,h[6],h[1],h[4],0,h[7],0,0,1,0,h[2],h[5],0,1].map(n=>Math.abs(n)<1e-10?0:n).join(',')})`}
function turn(point:Point,top:Point,bottom:Point,angle:number):Point{
 const length=Math.hypot(bottom[0]-top[0],bottom[1]-top[1]);
 const ax=(bottom[0]-top[0])/length,ay=(bottom[1]-top[1])/length;
 const dx=point[0]-top[0],dy=point[1]-top[1],along=dx*ax+dy*ay,across=dx*ay-dy*ax;
 const x=top[0]+along*ax+across*ay*Math.cos(angle),y=top[1]+along*ay-across*ax*Math.cos(angle);
 const depth=Math.abs(across)*Math.sin(angle),scale=7000/(7000-depth),cx=(top[0]+bottom[0])/2,cy=(top[1]+bottom[1])/2;
 return [cx+(x-cx)*scale,cy+(y-cy)*scale];
}
export function openingPose(value:number){
 const p=Math.max(0,Math.min(1,value));
 const right=RIGHT_PAGE.map((point,i)=>[mix(CLOSED_COVER[i][0],point[0],p),mix(CLOSED_COVER[i][1],point[1],p)] as Point) as unknown as Quad;
 const spread=homography(RIGHT_PAGE,right);
 // A plane exactly edge-on has no invertible projection. Clamp the hidden
 // side within 0.01 radian; visible frames retain the shared hinge exactly.
 const angle=Math.PI*p,coverAngle=Math.min(angle,Math.PI/2-.01);
 const coverQuad=[right[0],turn(right[1],right[0],right[3],coverAngle),turn(right[2],right[0],right[3],coverAngle),right[3]] as Quad;
 const leftAngle=Math.max(Math.PI-angle,0);
 const safeLeft=Math.abs(leftAngle-Math.PI/2)<.01?Math.PI/2-.01:leftAngle;
 const leftQuad=[turn(LEFT_PAGE[0],RIGHT_PAGE[0],RIGHT_PAGE[3],safeLeft),LEFT_PAGE[1],LEFT_PAGE[2],turn(LEFT_PAGE[3],RIGHT_PAGE[0],RIGHT_PAGE[3],safeLeft)] as Quad;
 return {spread,cover:homography(CLOSED_COVER,coverQuad),left:homography(LEFT_PAGE,leftQuad),leftArtwork:homography(LEFT_ART,leftQuad.map(unplate) as unknown as Quad),
  paperOpacity:Math.min(1,p/.08),coverOpacity:1-Math.max(0,Math.min(1,(p-.43)/.07)),
  leftOpacity:Math.max(0,Math.min(1,(p-.49)/.08)),printOpacity:Math.max(0,Math.min(1,(p-.64)/.25)),hinge:[right[0],right[3]]};
}
