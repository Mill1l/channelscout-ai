'use client';
import {useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,LoaderCircle} from 'lucide-react';
import {demoDestination} from '@/lib/experience';
export default function DemoLauncher({company='proasin',children,className='button primary'}:{company?:string;children:ReactNode;className?:string}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function start(){setBusy(true);setError('');try{const response=await fetch('/api/outreach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'initializeDemos',scope:'demo',confirmed:true})});if(!response.ok)throw new Error('初始化失败');router.push(demoDestination(company));}catch{setError('无法准备模拟案例，请确认工作区可用后重试。已有记录不会被清空，没有发送邮件。');}finally{setBusy(false);}}
 return <div className="demo-launcher"><button className={className} onClick={()=>void start()} disabled={busy}>{busy?<><LoaderCircle size={17} className="loading-spin"/>准备模拟案例…</>:<>{children}<ArrowRight size={17}/></>}</button>{error&&<p role="alert" className="launch-error">{error}</p>}</div>;
}
