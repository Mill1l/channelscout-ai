import type {ResearchDocument} from './types';
// Phase 1 已读取官网的短引文档案；不是当前实时抓取，也不是虚构 AI 响应。
export const DEMOS={
 proasin:{name:'Proasin',website:'https://proasin.cl/',companyId:'proasin',documents:[{url:'https://proasin.cl/',title:'Proasin · 官网短引文档案',text:'Equipos de aseo industrial. Aspiradoras industriales, barredoras, fregadoras. HORECA. Envio todo Chile.'},{url:'https://proasin.cl/servicio-tecnico/',title:'Proasin · 技术服务短引文档案',text:'MANTENIMIENTO REPUESTOS REPARACIONES CAPACITACIÓN. Servicio en terreno para diagnósticos y reparaciones.'}]},
 acquatecnia:{name:'Acquatecnia',website:'https://acquatecnia.cl/',companyId:'acquatecnia',documents:[{url:'https://acquatecnia.cl/tiendas',title:'Acquatecnia · 门店短引文档案',text:'ACQUATECNIA representa a las marcas líderes en equipos de limpieza industrial, con repuestos y servicio técnico propio.'}]},
 hoppe:{name:'Hoppe',website:'https://www.hoppechile.com/keenon-chile',companyId:'hoppe',documents:[{url:'https://www.hoppechile.com/keenon-chile',title:'Hoppe · Keenon 短引文档案',text:'En Hoppe somos representantes de Keenon Robotics en Chile. instalación, mapeo del recinto, configuración de rutas y capacitación. repuestos y soporte locales.'}]}
} as const;
export function demoDocuments(id:keyof typeof DEMOS):ResearchDocument[]{return DEMOS[id].documents.map((d,i)=>({...d,id:`doc-${i}`,status:'ok',method:'archive',capturedAt:'2026-11-01T06:24:00.000Z'}));}
