import {settleRound,ruleDecisions} from './engine';
self.onmessage=(event)=>{const {id,state,decisions}=event.data;try{self.postMessage({id,state:settleRound(state,decisions||ruleDecisions(state))})}catch(error){self.postMessage({id,error:String(error)})}};
