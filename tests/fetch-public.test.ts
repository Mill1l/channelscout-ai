import {describe,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import type {lookup} from 'node:dns/promises';
import {fetchPublic,publicAddress,publicUrl,cleanHtml,PublicTransport} from '../lib/research/fetch-public';
const resolver=(address='93.184.216.34')=>vi.fn(async()=>[{address,family:4}]) as unknown as typeof lookup;
const readable='<html><title>Public company</title><main>Industrial cleaning equipment and professional maintenance services.</main></html>';
describe('公开网页读取与 SSRF 边界',()=>{
 it.each(['http://proasin.cl/','https://127.0.0.1','https://2130706433','https://[::1]','https://localhost/','https://test.local/','https://proasin.cl:8443/','https://user:pass@proasin.cl/','https://proasin.cl/?api_key=secret'])('拒绝危险 URL %s',url=>expect(()=>publicUrl(url)).toThrow());
 it.each(['127.0.0.1','10.1.1.1','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','198.18.0.1','192.0.2.1','198.51.100.1','203.0.113.1','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1'])('拒绝非公网地址 %s',ip=>expect(publicAddress(ip)).toBe(false));
 it('允许正常公开 IPv4 与 IPv6',()=>{expect(publicAddress('93.184.216.34')).toBe(true);expect(publicAddress('2606:4700:4700::1111')).toBe(true);});
 it('DNS 私网地址阻断且不发送请求',async()=>{const request=vi.fn();const doc=await fetchPublic('https://proasin.cl/','d',{resolve:resolver('10.0.0.1'),request});expect(doc.status).toBe('failed');expect(doc.text).toBeNull();expect(request).not.toHaveBeenCalled();});
 it('固定解析后的 IP 给传输层，避免二次 DNS 绑定',async()=>{const request=vi.fn<PublicTransport>(async(_url,address)=>{expect(address.address).toBe('93.184.216.34');return {status:200,type:'text/html',body:readable};});const doc=await fetchPublic('https://proasin.cl/','d',{resolve:resolver(),request});expect(doc.status).toBe('ok');expect(doc.hash).toHaveLength(64);expect(doc.text).toContain('maintenance');});
 it('跨域重定向不自动跟随',async()=>{const request=vi.fn<PublicTransport>(async()=>({status:302,type:'text/html',location:'https://other.cl/private',body:''}));const doc=await fetchPublic('https://proasin.cl/','d',{resolve:resolver(),request});expect(doc.status).toBe('failed');expect(doc.error).toContain('跨域');expect(request).toHaveBeenCalledTimes(1);});
 it('同域重定向重新解析并防止指向内网',async()=>{let calls=0;const resolve=vi.fn(async()=>[{address:++calls===1?'93.184.216.34':'127.0.0.1',family:4}]) as unknown as typeof lookup;const request=vi.fn<PublicTransport>(async()=>({status:302,type:'text/html',location:'/next',body:''}));const doc=await fetchPublic('https://proasin.cl/','d',{resolve,request});expect(doc.status).toBe('failed');expect(request).toHaveBeenCalledTimes(1);});
 it('重定向循环受次数限制',async()=>{const request=vi.fn<PublicTransport>(async()=>({status:302,type:'text/html',location:'/loop',body:''}));expect((await fetchPublic('https://proasin.cl/','d',{resolve:resolver(),request})).status).toBe('failed');expect(request).toHaveBeenCalledTimes(3);});
 it('403 等网页错误不能虚构正文',async()=>{const request=vi.fn<PublicTransport>(async()=>({status:403,type:'text/html',body:'no'}));const doc=await fetchPublic('https://proasin.cl/','d',{resolve:resolver(),request});expect(doc.text).toBeNull();expect(doc.error).toContain('403');});
 it('访问验证只提示，不绕过',async()=>{const request=vi.fn<PublicTransport>(async()=>({status:200,type:'text/html',body:'Please verify you are human before continuing to our website.'}));const doc=await fetchPublic('https://proasin.cl/','d',{resolve:resolver(),request});expect(doc.error).toContain('未绕过');});
 it('网络异常返回失败状态，不返回伪造抓取结果',async()=>{const request=vi.fn<PublicTransport>(async()=>{throw new Error('timeout');});const doc=await fetchPublic('https://proasin.cl/','d',{resolve:resolver(),request});expect(doc.status).toBe('failed');expect(doc.text).toBeNull();});
 it('移除脚本、表单、页脚和联系方式，不执行网页指令',()=>{const text=cleanHtml('<script>sendSecrets()</script><form>password</form><main>Clean &amp; safe. contact@example.com +56 9 1234 5678</main><footer>hidden</footer>');expect(text).not.toMatch(/sendSecrets|password|contact@|1234|hidden/);expect(text).toContain('Clean & safe');});
 it('正文截断为最多 18000 字符',()=>expect(cleanHtml('<main>'+'x'.repeat(30000)+'</main>').length).toBe(18000));
});
it('原生 HTTPS 传输显式固定地址族，禁用 Node 24 多地址 lookup 回调，防止正常网站误报失败',async()=>{
 const https=await import('node:https');
 const spy=vi.spyOn(https.default,'request').mockImplementation(((_url:unknown,options:{family:number;autoSelectFamily:boolean;lookup:(h:string,o:object,cb:(e:null,ip:string,family:number)=>void)=>void},callback:(res:unknown)=>void)=>{
  expect(options.family).toBe(4);expect(options.autoSelectFamily).toBe(false);
  options.lookup('proasin.cl',{all:false},(_e,ip,family)=>{expect(ip).toBe('93.184.216.34');expect(family).toBe(4);});
  const req=new EventEmitter() as EventEmitter & {end:()=>void};req.end=()=>{const res=new PassThrough() as PassThrough & {statusCode:number;headers:Record<string,string>};res.statusCode=200;res.headers={'content-type':'text/html'};callback(res);res.end('<main>Professional public company equipment and service.</main>');};return req;
 }) as unknown as typeof https.default.request);
 try{const {transport}=await import('../lib/research/fetch-public');const r=await transport(new URL('https://proasin.cl/'),{address:'93.184.216.34',family:4},AbortSignal.timeout(1000));expect(r.status).toBe(200);}finally{spy.mockRestore();}
});
