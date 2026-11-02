import rawCompanies from '../data/companies.json';
import rawSources from '../data/sources.json';
import type { Company, Source } from './types';
import { validateData } from './engine';
export const companies = rawCompanies as Company[];
export const sources = rawSources as Source[];
const errors = validateData(companies,sources);
if(errors.length) throw new Error(`研究数据校验失败：${errors.join('; ')}`);
