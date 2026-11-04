import {salesView} from '@/lib/outreach/service';
import OutreachWorkbench from '@/components/outreach-workbench';
export const dynamic='force-dynamic';
export const metadata={title:'渠道策略、邮件与跟进'};
export default async function OutreachPage({searchParams}:{searchParams:Promise<{scope?:string;company?:string;guide?:string}>}){const params=await searchParams;return <OutreachWorkbench initial={await salesView(params.scope==='demo'?'demo':'main')} initialCompanyId={params.company} guided={params.guide==='1'}/>;}
