import {redactText,hasSensitiveText} from './privacy';
export type TokenUsage={inputTokens:number|null;outputTokens:number|null};
export type Metering={attemptId:string;requestedAt:string;model:string;outcome:'success'|'network_error'|'http_error'|'invalid_response';httpStatus:number|null;requestId:string|null;usageStatus:'known'|'partial'|'unknown';usage:TokenUsage;cacheHitTokens:number|null;cacheMissTokens:number|null;totalTokens:number|null;amount:null;currency:null;costStatus:'unknown';warning?:string};
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
export function tokenStatistics(raw:unknown){
 const u=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const inputTokens=count(u.prompt_tokens),outputTokens=count(u.completion_tokens);
 const details=u.prompt_tokens_details&&typeof u.prompt_tokens_details==='object'?u.prompt_tokens_details as Record<string,unknown>:{};
 let cacheHitTokens=count(u.prompt_cache_hit_tokens??details.cached_tokens),cacheMissTokens=count(u.prompt_cache_miss_tokens);
 if(cacheMissTokens===null&&inputTokens!==null&&cacheHitTokens!==null&&cacheHitTokens<=inputTokens)cacheMissTokens=inputTokens-cacheHitTokens;
 const inconsistent=inputTokens!==null&&(cacheHitTokens!==null&&cacheHitTokens>inputTokens||cacheMissTokens!==null&&cacheMissTokens>inputTokens||cacheHitTokens!==null&&cacheMissTokens!==null&&cacheHitTokens+cacheMissTokens!==inputTokens);
 if(inconsistent){cacheHitTokens=null;cacheMissTokens=null;}
 const total=count(u.total_tokens),expected=inputTokens!==null&&outputTokens!==null?inputTokens+outputTokens:null;
 const totalTokens=total!==null&&expected!==null&&total!==expected?null:total??expected;
 const usageStatus=inputTokens===null&&outputTokens===null?'unknown' as const:inputTokens!==null&&outputTokens!==null?'known' as const:'partial' as const;
 return {usage:{inputTokens,outputTokens},usageStatus,cacheHitTokens,cacheMissTokens,totalTokens,...(inconsistent||total!==null&&expected!==null&&total!==expected?{warning:'供应商用量字段不一致；金额未知，请核对账单。'}:{})};
}
export function safeRequestId(value:unknown,secrets:string[]=[]){return typeof value==='string'&&/^[a-z\d._:-]{1,100}$/i.test(value)&&!hasSensitiveText(value,secrets)?redactText(value,secrets):null;}
