import type { Metadata } from 'next';
import { ThemeToggle } from '@/components/ThemeToggle';
import './globals.css';
export const metadata:Metadata={title:'VibeCheck — Inspect the AI handoff',description:'Check AI completion claims against a fixed source revision and your project requirements. Inspect the evidence, compare a recheck and verify the complete report.'};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.classList.toggle('dark',localStorage.getItem('vibecheck-theme')==='dark')}catch(e){}"}}/></head><body><a className="skip-link" href="#inspector">Skip to workspace</a><header className="site-nav"><div className="nav-inner"><a className="wordmark" href="/" aria-label="VibeCheck home"><span className="brand-mark">V<span>✓</span></span>vibecheck<span className="brand-caption">THE HANDOFF, INSPECTED.</span></a><nav aria-label="Main navigation"><a href="/#inspector">Workspace</a><a href="/#method">Method</a><a href="/#evaluation">Evaluation</a><a href="https://github.com/kathir-iTech/Vibe_Check" target="_blank" rel="noreferrer">Source ↗</a><ThemeToggle/></nav></div></header>{children}</body></html>;
}
