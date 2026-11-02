import Link from 'next/link';
export default function NotFound(){return <div className="empty-state"><span className="eyebrow">404 / RECORD NOT FOUND</span><h1>未找到这份研究档案</h1><p>请从企业研究库选择一家公司。</p><Link className="button primary" href="/companies">返回企业研究库</Link></div>}
