import Link from 'next/link';
import { ArrowUpRight, ExternalLink, Info } from 'lucide-react';
import { sources } from '@/lib/data';
import { Category, Source } from '@/lib/types';
import { sourceHealth } from '@/lib/engine';
import { CATEGORY_LABELS } from '@/lib/engine';
export function Badge({category}:{category:Category}) {return <span className={`badge badge-${category}`}><span/>{CATEGORY_LABELS[category]}</span>}
export function PageHead({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}) {return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>}
export function EvidenceLinks({ids,allSources=sources}:{ids:string[];allSources?:Source[]}) {return <span className="evidence-links">{ids.map(id=>{const s=allSources.find(s=>s.id===id);return s?<a key={id} href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.title} · ${sourceHealth(s)==='current'?'当前有效':'需重新核验'}`}>{id}<ExternalLink size={10}/></a>:<span key={id}>来源无效：{id}</span>})}</span>}
export function Notice({children}:{children:React.ReactNode}) {return <div className="notice"><Info size={17}/><div>{children}</div></div>}
export function SectionTitle({title,kicker,href,label}:{title:string;kicker?:string;href?:string;label?:string}) {return <div className="section-title"><div><h2>{title}</h2>{kicker&&<p>{kicker}</p>}</div>{href&&<Link className="text-link" href={href}>{label??'查看全部'}<ArrowUpRight size={15}/></Link>}</div>}
export function Coverage({value}:{value:number}) {return <div className="coverage"><div className="coverage-track"><span style={{width:`${value}%`}}/></div><span>{value}%</span></div>}
