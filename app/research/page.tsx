import {readState,catalogFromState} from '@/lib/research/store';
import {providerConfig} from '@/lib/research/providers';
import Workbench from '@/components/research-workbench';
export const metadata={title:'AI 企业研究与审核'};
export default async function ResearchPage({searchParams}:{searchParams:Promise<{company?:string}>}){
 const state=await readState(),config=providerConfig(),params=await searchParams;
 return <Workbench initial={{state,...catalogFromState(state),provider:config.provider,paidEnabled:config.paidEnabled}} initialCompanyId={params.company}/>;
}
