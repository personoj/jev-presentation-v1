type Job<T,R>={key:string;value:T;apply:(result:R)=>void;fail:(error:unknown)=>void};
/** One in-flight review plus the latest pending input. New text does not reset
 * the launch deadline or repeatedly abort a healthy cloud request. */
export class LatestReviewQueue<T,R>{
 private active:{job:Job<T,R>;controller:AbortController;timeout?:ReturnType<typeof setTimeout>}|null=null;
 private pending:Job<T,R>|null=null;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private lastStart=-Infinity;
 constructor(private run:(value:T,signal:AbortSignal)=>Promise<R>,private intervalMs=250,private timeoutMs=2500){}
 enqueue(job:Job<T,R>){
  if(this.active?.job.key===job.key){this.active.job=job;this.pending=null;return}
  this.pending=job;this.schedule();
 }
 cancel(){clearTimeout(this.timer);this.timer=undefined;this.pending=null;clearTimeout(this.active?.timeout);this.active?.controller.abort();this.active=null;this.lastStart=-Infinity}
 private schedule(){
  if(this.active||this.timer||!this.pending)return;
  const wait=Math.max(0,this.intervalMs-(Date.now()-this.lastStart));
  if(wait===0)this.launch();else this.timer=setTimeout(()=>{this.timer=undefined;this.launch()},wait);
 }
 private launch(){
  if(this.active||!this.pending)return;
  const active:{job:Job<T,R>;controller:AbortController;timeout?:ReturnType<typeof setTimeout>}={job:this.pending,controller:new AbortController()};this.active=active;this.pending=null;this.lastStart=Date.now();
  const deadline=new Promise<never>((_,reject)=>{active.timeout=setTimeout(()=>{reject(new Error('本次文本核对超时，保持已确认位置。'));active.controller.abort()},this.timeoutMs)});
  Promise.race([Promise.resolve().then(()=>this.run(active.job.value,active.controller.signal)),deadline]).then(result=>{
   if(this.active===active)active.job.apply(result);
  },error=>{if(this.active===active)active.job.fail(error)}).finally(()=>{
   clearTimeout(active.timeout);if(this.active!==active)return;this.active=null;this.schedule();
  });
 }
}
