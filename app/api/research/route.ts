import {readState,catalogFromState} from '@/lib/research/store';
import {providerConfig} from '@/lib/research/providers';
import {requestJson,failure} from '@/lib/research/http';
import {createResearch} from '@/lib/research/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const state=await readState();const cfg=providerConfig();return Response.json({...catalogFromState(state),state,provider:cfg.provider,paidEnabled:cfg.paidEnabled},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{return Response.json(await createResearch(await requestJson(request)),{status:201});}catch(e){return failure(e);}}
