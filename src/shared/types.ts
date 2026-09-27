export type Question={type:'choice'|'noul'|'score'; instructions:string|Record<string,unknown>;criteria?:Record<string,unknown>|unknown[]};
export type Answer={type?:string;choice?:string;noul?:number;score?:number;confidence?:number;probabilities?:Record<string,number>;legend?:Record<string,string>};
export type Evaluation={requestId:string;stateVersion?:number;model:string;answers:Record<string,Answer>;usage?:Record<string,number>;elapsedMs:number;source:'live'};
export type RecordEvent={id:string;label:string;at:string;input:unknown;output:unknown;source:'live'|'replay'|'illustration'|'rules'};
export type FeatureProps={onRecord?:(event:RecordEvent)=>void;onQuota?:(message:string)=>void};
