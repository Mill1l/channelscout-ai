import {getCatalog} from '@/lib/research/store';
import Link from 'next/link';
import Explorer from '@/components/company-explorer';
import {Notice,PageHead} from '@/components/ui';
export const metadata={title:'企业研究'};
export default async function Companies(){const {companies,sources}=await getCatalog();return <><PageHead eyebrow="COMPANY INTELLIGENCE" title="先找到值得研究的企业" description="先按渠道关系分组，再看业务与证据覆盖率。点击企业，查看它为什么值得研究。" action={<Link className="button primary" href="/research">研究一家新企业</Link>}/><div className="howto-panel"><h2>第一次可以从 Proasin 开始</h2><p>在搜索框输入企业名，点击“查看档案”，先看产品与服务证据，再看六维评分。分高不等于适合马上联系。</p></div><Notice>潜在伙伴是研究对象分组，普渡关系仍可能未知。现有渠道依据企业公开宣称单列；并未获得品牌方独立确认。</Notice><Explorer companies={companies} sources={sources}/></>}
