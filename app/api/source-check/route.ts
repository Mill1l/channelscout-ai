import {requestJson,failure,throttle} from '@/lib/research/http';
import {readState,catalogFromState,mutateState} from '@/lib/research/store';
import {fetchPublic} from '@/lib/research/fetch-public';
import {ResearchError,text} from '@/lib/research/validation';
export const runtime='nodejs';
export async function POST(request:Request){try{const input=await requestJson(request);throttle('source-check',15);const {sources}=catalogFromState(await readState());const source=sources.find(s=>s.id===text(input.sourceId,200));if(!source)throw new ResearchError('来源不存在。',404);const doc=await fetchPublic(source.url,'link-check');const result={at:new Date().toISOString(),status:doc.status==='ok'?'ok' as const:'failed' as const,...(doc.error?{error:doc.error}:{})};await mutateState(state=>{const previous=state.sourceChecks[source.id];state.sourceChecks[source.id]={...result,needsReview:result.status==='failed'||previous?.status==='failed'||previous?.needsReview===true};state.audit.push({at:result.at,action:`source_check_${result.status}: ${source.id}`});});return Response.json(result);}catch(e){return failure(e);}}
