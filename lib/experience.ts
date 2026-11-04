/** Task navigation never asserts that a company has qualified or passed review. */
export const WORKFLOW = [
 {id:'discover',number:'01',href:'/companies',label:'找企业',detail:'筛选业务相关的公司',output:'一份待研究名单',color:'blue'},
 {id:'verify',number:'02',href:'/research',label:'核验证据',detail:'读原文，确认事实与未知',output:'可追溯的企业档案',color:'teal'},
 {id:'assess',number:'03',href:'/priorities',label:'判断渠道',detail:'比较能力、缺口与风险',output:'有依据的研究顺序',color:'violet'},
 {id:'outreach',number:'04',href:'/outreach',label:'准备跟进',detail:'拟邮件，记录下一步任务',output:'草稿与人工跟进记录',color:'amber'},
] as const;
export function workflowForPath(path:string){path=path.replace(/\/$/,'')||'/';if(path.startsWith('/companies/'))return WORKFLOW[1];return WORKFLOW.find(step=>path===step.href);}
export const DEMO_CASES = [
 {id:'proasin',name:'Proasin',type:'潜在渠道',color:'blue',question:'业务相关，下一步怎么接触？',description:'从清洁设备与服务证据出发，查看合作切入点和西语草稿。',action:'体验潜在渠道案例'},
 {id:'hoppe',name:'Hoppe',type:'竞争渠道',color:'amber',question:'已经经营竞品，还能合作吗？',description:'识别 Keenon 相关证据，先核实品类和排他限制，不预设合作意愿。',action:'体验竞品判断案例'},
 {id:'dimacofi',name:'Dimacofi',type:'现有渠道',color:'violet',question:'已有普渡关系，如何避免重复开发？',description:'区分渠道维护与新客开发；企业公开宣称仍不等于厂家独立确认。',action:'体验渠道维护案例'},
] as const;
export function demoDestination(companyId:string){const id=DEMO_CASES.some(c=>c.id===companyId)?companyId:'proasin';return `/outreach?scope=demo&company=${encodeURIComponent(id)}&guide=1`;}
