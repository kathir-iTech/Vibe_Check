import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";
const bodyFont = localFont({
  src: "../../public/fonts/dm-sans.ttf",
  variable: "--font-body",
  display: "swap",
  weight: "100 1000",
});
const displayFont = localFont({
  src: "../../public/fonts/space-grotesk.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "300 700",
});
export const metadata: Metadata = {
  title: "VibeCheck — Inspect the AI handoff",
  description:
    "Check AI completion claims against a fixed source revision and your project requirements. Inspect the evidence, compare a recheck and verify the complete report.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.toggle('dark',localStorage.getItem('vibecheck-theme')!=='light')}catch(e){}",
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#inspector">
          Skip to workspace
        </a>
        <header className="site-nav">
          <div className="nav-inner">
            <a className="wordmark" href="/" aria-label="VibeCheck home">
              <span className="brand-mark">
                V<span>✓</span>
              </span>
              vibecheck<span className="brand-period">.</span>
            </a>
            <nav aria-label="Main navigation">
              <a href="/#inspector">Workspace</a>
              <a href="/#method">How it works</a>
              <a href="/#evaluation">Proof</a>
              <a
                href="https://github.com/kathir-iTech/Vibe_Check"
                target="_blank"
                rel="noreferrer"
              >
                Source ↗
              </a>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
