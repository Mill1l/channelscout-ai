import {requestJson,failure} from '@/lib/research/http';
import {submitReview,rejectDraft} from '@/lib/research/service';
export const runtime='nodejs';
export async function POST(request:Request){try{const input=await requestJson(request);return Response.json(input.action==='reject'?await rejectDraft(input):await submitReview(input));}catch(e){return failure(e);}}
