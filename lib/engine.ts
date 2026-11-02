import { Company, Source, Dimension, Category, FIELD_LABELS } from './types';
export const DIMENSIONS: { key: Dimension; label: string; weight: number }[] = [
 { key: 'product', label: '产品业务匹配', weight: 25 }, { key: 'customers', label: 'B2B 客户资源匹配', weight: 20 },
 { key: 'technical', label: '技术及售后能力', weight: 20 }, { key: 'coverage', label: '地区覆盖', weight: 15 },
 { key: 'robotics', label: '机器人经验', weight: 10 }, { key: 'cooperation', label: '渠道合作适配性', weight: 10 },
];
export const CATEGORY_LABELS: Record<Category, string> = { potential: '潜在合作伙伴', existing: '现有渠道标杆', competitor: '竞争渠道', unknown: '关系未知企业' };
export const KIND_LABELS = { fact: '官网事实 / 企业表述', inference: 'AI 推断', human: '人工判断' };
export function validDate(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function sourceHealth(s: Source, now = new Date()): 'current' | 'stale' | 'failed' | 'indexed' | 'invalid' {
 if (!validDate(s.checkedAt)) return 'invalid';
 let url: URL; try { url=new URL(s.url); } catch { return 'invalid'; }
 if(url.protocol!=='https:' || !url.hostname || url.username || url.password || !s.summary.trim()) return 'invalid';
 const age=(Date.parse(now.toISOString().slice(0,10))-Date.parse(s.checkedAt))/86400000;
 if(age<0) return 'invalid';
 if(s.lastAttempt?.needsReview || s.lastAttempt?.status==='failed' || s.status==='failed') return 'failed';
 if(s.status==='indexed') return 'indexed';
 if(age>90) return 'stale';
 return 'current';
}
export function usableEvidence(ids: string[], sources: Source[], now = new Date()) {
 return ids.length>0 && ids.every(id=>sources.some(s=>s.id===id && sourceHealth(s,now)==='current'));
}
function historicalRelationship(c: Company, sources: Source[]) {
 return c.relationship.status!=='unknown' && c.relationship.evidenceIds.length>0 && c.relationship.evidenceIds.every(id=>sources.some(s=>s.id===id && s.status==='reviewed' && validDate(s.checkedAt)));
}
function validHuman(c: Company) {
 return !!c.humanReview?.reviewer.trim() && !!c.humanReview.note.trim() && validDate(c.humanReview.date) && c.humanReview.date<=new Date().toISOString().slice(0,10);
}
export function classify(c: Company, sources: Source[]): Category {
 if (historicalRelationship(c,sources)) return 'existing';
 if (c.researchRole === 'competitor' && usableEvidence(c.fields.competition.evidenceIds, sources)) return 'competitor';
 if (c.researchRole === 'potential' && usableEvidence(c.fields.business.evidenceIds, sources)) return 'potential';
 return 'unknown';
}
export function relationshipLabel(c: Company, sources: Source[]) {
 if (!historicalRelationship(c,sources)) return '与普渡关系未知';
 if (!usableEvidence(c.relationship.evidenceIds,sources)) return '历史渠道关系线索 · 来源待重新核验';
 if (c.relationship.status === 'brand_confirmed' && c.relationship.brandConfirmed && c.relationship.evidenceIds.some(id => sources.some(s => s.id === id && s.publisher === 'brand' && s.status === 'reviewed'))) return '品牌方独立确认';
 return '企业公开宣称 · 品牌方未独立确认';
}
export function evaluate(c: Company, sources: Source[]) {
 let earned = 0, covered = 0;
 const dimensions = DIMENSIONS.map(d => {
  const a = c.assessments[d.key];
  const valid = a?.value !== null && Number.isFinite(a?.value) && a.value! >= 0 && a.value! <= 4 && Number.isInteger(a.value) && !!a.rationale.trim() && usableEvidence(a.evidenceIds, sources) && (a.kind!=='human' || validHuman(c));
  if (valid) { covered += d.weight; earned += (a.value! / 4) * d.weight; }
  return { ...d, value: valid ? a.value : null, rationale: a?.rationale ?? '无评估', evidenceIds: a?.evidenceIds ?? [], kind: a?.kind ?? 'inference', invalidEvidence: a?.value != null && !valid };
 });
 const fields = [c.city, ...Object.values(c.fields)];
 const complete = fields.filter(f => f.kind === 'fact' && f.value !== null && !!f.value.trim() && usableEvidence(f.evidenceIds, sources)).length;
 return { score: covered ? Math.round(earned / covered * 1000) / 10 : null, coverage: covered, supported: Math.round(earned * 10) / 10,
  interval: [Math.round(earned * 10) / 10, Math.round((earned + 100 - covered) * 10) / 10],
  limited: covered < 60, completeness: Math.round(complete / fields.length * 100), dimensions, missing: dimensions.filter(d => d.value === null),
  missingFields: [ ...(c.city.value === null ? ['城市'] : []), ...Object.entries(c.fields).filter(([, f]) => f.kind!=='fact' || f.value === null || !usableEvidence(f.evidenceIds, sources)).map(([k]) => FIELD_LABELS[k as keyof typeof FIELD_LABELS]) ] };
}
export type Filters = { query?: string; category?: Category | 'all'; minCoverage?: number; sort?: 'research' | 'score' | 'coverage' | 'name' };
export function selectCompanies(companies: Company[], sources: Source[], filters: Filters = {}) {
 const q = (filters.query ?? '').trim().toLocaleLowerCase();
 return companies.filter(c => (!q || [c.name,c.country,c.city.value,...Object.values(c.fields).map(f=>f.value)].filter(Boolean).join(' ').toLocaleLowerCase().includes(q)) &&
  (!filters.category || filters.category === 'all' || classify(c,sources) === filters.category) && evaluate(c,sources).coverage >= (filters.minCoverage ?? 0))
 .sort((a,b) => {
  const x=evaluate(a,sources), y=evaluate(b,sources);
  if (filters.sort === 'name') return a.name.localeCompare(b.name,'en');
  const primary = filters.sort === 'score' ? (y.score ?? -1)-(x.score ?? -1) : filters.sort === 'coverage' ? y.coverage-x.coverage : y.supported-x.supported;
  return primary || y.coverage-x.coverage || a.name.localeCompare(b.name,'en');
 });
}
export function researchQueue(companies: Company[], sources: Source[]) {
 return selectCompanies(companies,sources,{category:'potential',sort:'research'});
}
export function validateData(companies: Company[], sources: Source[]) {
 const errors: string[]=[];
 const seen=new Set<string>();
 for(const s of sources){if(seen.has(s.id))errors.push(`重复来源 ${s.id}`);seen.add(s.id);if(!/^https:\/\//.test(s.url))errors.push(`无效 URL ${s.id}`);}
 const companyIds=new Set<string>();
 for(const c of companies){
  if(companyIds.has(c.id))errors.push(`重复企业 ${c.id}`);companyIds.add(c.id);
  for(const f of [c.city,...Object.values(c.fields)]){
   if(f.value !== null && (!f.value.trim() || !f.evidenceIds.length || f.evidenceIds.some(id=>!sources.some(s=>s.id===id && s.status==='reviewed'))))errors.push(`${c.id}: 字段缺少可用证据`);
   if(f.kind==='human' && !validHuman(c))errors.push(`${c.id}: 未授权人工判断`);
  }
  for(const d of DIMENSIONS){const a=c.assessments[d.key];if(a?.value!=null && (!Number.isInteger(a.value) || a.value<0 || a.value>4 || !a.rationale.trim() || !a.evidenceIds.length || a.evidenceIds.some(id=>!sources.some(s=>s.id===id && s.status==='reviewed')) || (a.kind==='human' && !validHuman(c))))errors.push(`${c.id}: 无效评分 ${d.key}`);}
  if(c.relationship.status!=='unknown' && !historicalRelationship(c,sources)) errors.push(`${c.id}: 关系无证据`);
  if(c.relationship.status==='brand_confirmed' && relationshipLabel(c,sources)!=='品牌方独立确认')errors.push(`${c.id}: 厂家确认无品牌证据`);
 }
 return errors;
}

// Preserve explicitly mapped legacy research records; new companies must never
// inherit Proasin's source prefix just because they are absent from that map.
export function companySources(c:Company,sources:Source[]){
 const prefixes:Record<string,string>={proasin:'pro-',sauber:'sau-','general-trade':'gt-',acquatecnia:'acq-',dimacofi:'dim-','vic-robotics':'vic-',hoppe:'hop-'};
 const ids=new Set([c.city,...Object.values(c.fields)].flatMap(f=>f.evidenceIds).concat(Object.values(c.assessments).flatMap(a=>a.evidenceIds),c.relationship.evidenceIds));
 const prefix=prefixes[c.id];
 return sources.filter(s=>ids.has(s.id)||!!prefix&&s.id.startsWith(prefix));
}
