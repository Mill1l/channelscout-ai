import {failure,requestJson} from '@/lib/research/http';
import {salesAction,salesView,parseScope,salesCsv} from '@/lib/outreach/service';
import {initializeDemos} from '@/lib/outreach/demos';
import {redactValue} from '@/lib/research/privacy';
import {ResearchError} from '@/lib/research/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const url=new URL(request.url),view=await salesView(parseScope(url.searchParams.get('scope')));const format=url.searchParams.get('export');if(format==='csv')return new Response(salesCsv(view),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="channelscout-${view.scope}.csv"`,'Cache-Control':'no-store'}});if(format==='json')return Response.json(redactValue({format:'channelscout-outreach-export-v1',exportedAt:new Date().toISOString(),simulated:view.scope==='demo',...view}),{headers:{'Content-Disposition':`attachment; filename="channelscout-${view.scope}.json"`,'Cache-Control':'no-store'}});return Response.json(view,{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{const input=await requestJson(request);if(input.action==='initializeDemos'){if(input.scope!=='demo'||input.confirmed!==true)throw new ResearchError('仅在明确确认后初始化隔离模拟演示。');return Response.json(await initializeDemos());}return Response.json(await salesAction(input));}catch(e){return failure(e);}}
