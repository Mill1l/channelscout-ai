// Shared text boundary: no raw credentials or contact details in ordinary records.
// This is conservative redaction, not identity recognition or a universal DLP model.
const contactPatterns=()=>[
 /(?<![\w.+-])[\w.+-]{1,64}@[\w.-]{1,253}\.[a-z]{2,24}/gi,
 /\+\s*\(?\s*\d[\d\s().-]{6,}\d/g,
 /\b(?:tel[eé]fono|tel|phone|mobile|whatsapp|fax)\s*[:：]?\s*(?:\+\s*)?\d[\d\s().-]{5,}\d/gi,
 /(?:电话|手机)\s*[:：]?\s*(?:\+\s*)?\d[\d\s().-]{5,}\d/g,
 /(?:contact person|contacto|联系人)\s*[:：]\s*[^\n;。]{2,100}/gi
];
export function configuredSecrets(){return typeof process!=='undefined'?[process.env.DEEPSEEK_API_KEY].filter((x):x is string=>!!x&&x.length>=4):[];}
export function redactText(input:string,secrets:string[]=configuredSecrets()){
 let value=input;
 for(const secret of secrets)if(secret)value=value.split(secret).join('[凭证已移除]');
 value=value.replace(/(?:身份证|护照|passport|dni|rut|iban|bank account|ssn)\s*[:：=]\s*[a-z\d .-]{4,40}/gi,'[身份信息已移除]');
 value=value.replace(/\bsk-[a-z\d_-]{8,}/gi,'[凭证已移除]')
  .replace(/\b(?:Bearer\s+)[a-z\d._~+\/-]{4,}/gi,'Bearer [凭证已移除]')
  .replace(/\b(?:api[_ -]?key|password|secret|access[_ -]?token|authorization)\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s&,;]+)/gi,'[凭证已移除]');
 const patterns=contactPatterns();
 if(value.includes('@'))value=value.replace(patterns[0],'[联系方式已移除]');
 if(value.includes('+'))value=value.replace(patterns[1],'[联系方式已移除]');
 for(const pattern of patterns.slice(2))value=value.replace(pattern,'[联系方式已移除]');
 return value;
}
export function hasSensitiveText(value:string,secrets:string[]=configuredSecrets()){return redactText(value,secrets)!==value;}
const sensitiveKey=/^(?:api[_ -]?key|authorization|password|secret|(?:access|refresh|private)[_ -]?(?:token|key)|cookie|set-cookie|email|phone|telephone|mobile|contact[_ -]?(?:name|person)|联系人|手机号|身份证|passport|iban|ssn)$/i;
export function redactValue<T>(value:T,secrets:string[]=configuredSecrets()):T{
 if(typeof value==='string')return redactText(value,secrets) as T;
 if(Array.isArray(value))return value.map(x=>redactValue(x,secrets)) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[redactText(k,secrets),sensitiveKey.test(k)&&v!==null&&v!==undefined?'[敏感字段已移除]':redactValue(v,secrets)])) as T;
 return value;
}
