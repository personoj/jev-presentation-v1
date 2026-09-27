import type {Question,Evaluation} from './types';
export class APIError extends Error {constructor(message:string,public code:string,public status=0){super(message)}}
export async function evaluate(state:unknown,questions:Record<string,Question>,options:{signal?:AbortSignal;stateVersion?:number}={}):Promise<Evaluation>{
 const requestId=crypto.randomUUID();
 const response=await fetch('/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,stateVersion:options.stateVersion,state,questions}),signal:options.signal});
 const data=await response.json();
 if(!response.ok)throw new APIError(data.message||'请求未完成',data.code||'API_ERROR',response.status);
 return data;
}
