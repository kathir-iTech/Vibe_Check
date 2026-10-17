import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeCheck — Build-Honesty & Spec-Drift Auditor",
  description:
    "Verify AI coding agents' completion claims against real GitHub repository files, commit diffs, and planning specs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased selection:bg-emerald-500/20 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <a
              href="/"
              className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 font-mono text-xs font-bold text-white shadow-sm shadow-emerald-600/30"
              >
                V
              </span>
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                VibeCheck
              </span>
              <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 sm:inline-block dark:text-emerald-300">
                Build-Honesty Auditor
              </span>
            </a>

            <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <a
                href="/#inspector"
                className="rounded-md px-2 py-1 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                Inspector
              </a>
              <a
                href="/#self-audit"
                className="rounded-md px-2 py-1 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                Self-Audit &amp; Benchmark
              </a>
              <a
                href="/?demo=1"
                className="rounded-md border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-zinc-800 transition-colors hover:border-emerald-500/40 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-emerald-400"
              >
                ?demo=1
              </a>
              <ThemeToggle />
              <a
                href="https://github.com/kathir-iTech/Vibe_Check"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
              >
                GitHub ↗
              </a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
