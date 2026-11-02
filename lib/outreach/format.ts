// Deterministic across server/browser locale and time zone; no hydration suppression.
export function timestamp(value:string){const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,19).replace('T',' ')+' UTC':'日期未知';}
// Native date controls are submitted from the form, not a possibly stale React state.
export function formDate(form:FormData,key:'nextDate'|'contactDate'){const value=form.get(key);return typeof value==='string'&&value!==''?value:null;}
