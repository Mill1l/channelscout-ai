import {getCatalog} from '@/lib/research/store';
import Link from 'next/link';
import Explorer from '@/components/company-explorer';
import {Notice,PageHead} from '@/components/ui';
export const metadata={title:'企业研究'};
export default async function Companies(){const {companies,sources}=await getCatalog();return <><PageHead eyebrow="COMPANY INTELLIGENCE" title="企业研究库" description="从业务匹配到部署能力，逐项追溯每一家企业的公开证据。" action={<Link className="button primary" href="/research">新增 AI 企业研究</Link>}/><Notice>潜在伙伴是研究对象分组，普渡关系仍可能未知。现有渠道依据企业公开宣称单列；并未获得品牌方独立确认。</Notice><Explorer companies={companies} sources={sources}/></>}
