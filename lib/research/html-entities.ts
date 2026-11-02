import named from './html-entities.json';
// Semicolon-terminated HTML5 named references (including Spanish accents),
// generated offline from Python stdlib html.entities.html5. No runtime network/package.
// Decode once, after HTML tokenization: escaped tags remain text, never executable.
const names:Record<string,string>=named;
const controls:Record<number,number>={128:8364,130:8218,131:402,132:8222,133:8230,134:8224,135:8225,136:710,137:8240,138:352,139:8249,140:338,142:381,145:8216,146:8217,147:8220,148:8221,149:8226,150:8211,151:8212,152:732,153:8482,154:353,155:8250,156:339,158:382,159:376};
export function decodeHtmlEntities(input:string){
 return input.replace(/&(#(?:[xX][\da-fA-F]+|\d+)|[a-zA-Z][a-zA-Z0-9]+);/g,(reference:string,key:string)=>{
  if(key[0]!=='#')return Object.hasOwn(names,key)?names[key]:reference;
  const raw=key.slice(1),n=/^[xX]/.test(raw)?parseInt(raw.slice(1),16):Number(raw);
  if(!Number.isFinite(n)||n===0||n>0x10ffff||n>=0xd800&&n<=0xdfff)return '\uFFFD';
  return String.fromCodePoint(controls[n]??n);
 });
}
