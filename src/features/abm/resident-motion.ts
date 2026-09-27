import type {Economy,Transaction} from './engine';

export type Point={x:number;y:number};
export type ResidentPose='idle'|'walk'|'interact';
export const RESIDENT_ATLASES={portrait:'/art/town-residents.png',idle:'/art/town-idle.png',walkA:'/art/town-walk-a.png',walkB:'/art/town-walk-b.png',interact:'/art/town-interact.png'} as const;
export const SHOP_DOORS:Record<string,Point>={B01:{x:23,y:28},T01:{x:50,y:27},B02:{x:76.5,y:28}};
// Visual coordinates are separate from travel burdens in the economic model.
const HOMES:Point[]=[{x:10,y:86},{x:24,y:88},{x:41,y:86},{x:58,y:88},{x:78,y:86},{x:94,y:88},{x:38.5,y:48},{x:62,y:48}];
export const residentHome=(index:number):Point=>({...HOMES[index%HOMES.length]});
export function residentDestination(state:Economy,index:number):Point{
 const decision=state.history.at(-1)?.decisions.find(d=>d.residentId===state.residents[index].id);
 if(!decision||decision.failed||decision.action==='wait')return residentHome(index);
 const door=SHOP_DOORS[decision.action];
 if(!door)return residentHome(index);
 // Assign places within each shop queue, rather than reusing an identity's column.
 const visitors=state.residents.filter(r=>state.history.at(-1)?.decisions.some(d=>d.residentId===r.id&&!d.failed&&d.action===decision.action));
 const slot=visitors.findIndex(r=>r.id===decision.residentId);
 return{x:door.x+[-8,-2.7,2.7,8][slot%4],y:door.y+5+Math.floor(slot/4)*4};
}
const nearest=(x:number,lanes:number[])=>lanes.reduce((a,b)=>Math.abs(x-a)<Math.abs(x-b)?a:b);
const district=(p:Point)=>p.y<39?'north':p.y<66?'park':'south';
const add=(points:Point[],point:Point)=>{if(!points.length||Math.hypot(points.at(-1)!.x-point.x,points.at(-1)!.y-point.y)>.05)points.push(point)};
/** Routes use the visible street network; they never cross the central fountain or houses. */
export function residentRoute(from:Point,to:Point):Point[]{
 const points:Point[]=[from],fromDistrict=district(from),toDistrict=district(to);
 if(Math.hypot(from.x-to.x,from.y-to.y)<.2)return[from,to];
 if(fromDistrict==='north'&&toDistrict==='north')return[from,{x:from.x,y:34},{x:to.x,y:34},to];
 const fromJunction=fromDistrict==='south'?{x:nearest(from.x,[15,50,85]),y:57}:{x:nearest(from.x,[22.5,38.5,62,77]),y:57};
 const toJunction=toDistrict==='south'?{x:nearest(to.x,[15,50,85]),y:57}:{x:nearest(to.x,[22.5,38.5,62,77]),y:57};
 if(fromDistrict==='south'){add(points,{x:from.x,y:88});add(points,{x:fromJunction.x,y:88})}
 else if(fromDistrict==='north'){add(points,{x:from.x,y:34});add(points,{x:fromJunction.x,y:34})}
 else add(points,{x:fromJunction.x,y:from.y});
 add(points,fromJunction);add(points,toJunction);
 if(toDistrict==='south'){add(points,{x:toJunction.x,y:88});add(points,{x:to.x,y:88})}
 else if(toDistrict==='north'){add(points,{x:toJunction.x,y:34});add(points,{x:to.x,y:34})}
 else add(points,{x:toJunction.x,y:to.y});
 add(points,to);return points;
}
export function routeKeyframes(points:Point[]){
 const distances=points.map((point,i)=>i?Math.hypot(point.x-points[i-1].x,(point.y-points[i-1].y)*941/1672):0);
 const length=distances.reduce((sum,d)=>sum+d,0);let distance=0;
 return points.map((point,i)=>{distance+=distances[i];return{left:`${point.x}%`,top:`${point.y}%`,offset:length?distance/length:i/(points.length-1)}});
}
export function residentArrivalPose(transaction?:Pick<Transaction,'status'>):ResidentPose{return transaction?.status==='settled'?'interact':'idle'}
export function shouldAnimateResidents(previous:{seed:number;policy:boolean;round:number},next:{seed:number;policy:boolean;round:number},reducedMotion:boolean){return !reducedMotion&&previous.seed===next.seed&&previous.policy===next.policy&&next.round===previous.round+1}
/** Invalidating a run also invalidates all delayed arrivals from that run. */
export function createMotionEpoch(){let version=0;return{begin:()=>++version,invalidate:()=>{version++},isCurrent:(token:number)=>token===version}}
