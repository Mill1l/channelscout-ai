export type KnowledgeKind = 'fact' | 'inference' | 'human';
export type Source = { id: string; url: string; title: string; summary: string; status: 'reviewed' | 'indexed' | 'failed'; checkedAt: string; publisher: 'company' | 'brand'; note: string; retrieval?: 'live' | 'manual' | 'archive'; lastAttempt?: { at: string; status: 'ok' | 'failed'; error?: string; needsReview?: boolean } };
export type Field = { value: string | null; evidenceIds: string[]; kind: KnowledgeKind; citations?: { sourceId: string; quote: string }[] };
export const FIELD_LABELS = { business: '企业业务类型', products: '主要产品及服务', industries: '主要服务行业', customers: 'B2B 客户类型', deployment: '技术部署能力', afterSales: '售后维修能力', coverage: '地区覆盖', brands: '已知展示 / 代理品牌', competition: '潜在竞争关系' } as const;
export type Dimension = 'product' | 'customers' | 'technical' | 'coverage' | 'robotics' | 'cooperation';
export type Assessment = { value: number | null; evidenceIds: string[]; rationale: string; kind: 'inference' | 'human'; citations?: { sourceId: string; quote: string }[] };
export type Category = 'potential' | 'existing' | 'competitor' | 'unknown';
export type Company = {
 id: string; name: string; initials: string; country: string | null; city: Field; website: string; summary: string;
 fields: Record<keyof typeof FIELD_LABELS, Field>;
 relationship: { status: 'unknown' | 'public_claim' | 'brand_confirmed'; evidenceIds: string[]; claim: string | null; brandConfirmed: boolean };
 researchRole: 'potential' | 'benchmark' | 'competitor' | 'unknown'; assessments: Record<Dimension, Assessment>;
 reviewWarnings?: string[]; risks: string[]; nextSteps: string[]; checkedAt: string; confidence: string; humanReview: null | { reviewer: string; date: string; note: string; verifiedFields?: string[]; unknownFields?: string[]; inferenceFields?: string[]; reviewedDimensions?: Dimension[] };
};
