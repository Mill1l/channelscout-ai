import {hasSensitiveText} from '../research/privacy';
export function mailWarnings(subject:string,body:string){const value=subject+'\n'+body;const issues:string[]=[];if(hasSensitiveText(value))issues.push('包含联系方式或敏感内容');
 if(/(?:we are|i am|somos|soy).{0,35}(?:official|authorized|autorizad[oa]|oficial)|(?:guarantee|garantiza|garantizamos|guaranteed|ROI|return on investment|profit margin|rentabilidad garantizada|exclusive rights|exclusividad garantizada|\d+\s*%|\d+\s*(?:m²|m2|sqm|hours|horas))|(?:you have agreed|ya han aceptado|expressed interest|expresado inter[eé]s)|普渡官方|授权代表|保证收益|保证性能/iu.test(value))issues.push('存在身份、意愿、性能、收益或政策承诺风险');
 return issues;}
