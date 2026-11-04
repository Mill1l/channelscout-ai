import type { Metadata } from 'next';
import Shell from '@/components/shell';
import './globals.css';
import './experience.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:{default:'ChannelScout AI · 智利渠道研究',template:'%s | ChannelScout AI'},description:'证据驱动的海外渠道研究与合作伙伴能力评估。独立学习项目。'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN"><body><Shell>{children}</Shell></body></html>}
