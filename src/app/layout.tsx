import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeCheck — Forensic Build-Honesty & Spec-Drift Auditor",
  description:
    "Cross-check AI coding agents' completion claims against real GitHub repository files, commit diffs, and planning specs (scope.md / prd.md / spec.md).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased selection:bg-emerald-500/20 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/95 backdrop-blur dark:border-zinc-800/90 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <a
                href="/"
                className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-md"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 font-mono text-xs font-bold text-white shadow-sm"
                >
                  V
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      VibeCheck
                    </span>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Static Repo + Spec Auditor
                    </span>
                  </div>
                </div>
              </a>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <a
                href="/#inspector"
                className="transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Inspector
              </a>
              <a
                href="/#self-audit"
                className="transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Self-Audit
              </a>
              <a
                href="/#casebook"
                className="transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                8-Build Casebook
              </a>
              <a
                href="/#benchmark"
                className="transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Benchmark
              </a>
              <a
                href="/demo"
                className="rounded-md border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-zinc-800 transition-colors hover:border-emerald-500/40 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-emerald-400"
              >
                /demo
              </a>
              <a
                href="https://github.com/kathir-iTech/Vibe_Check"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
              >
                GitHub &nearr;
              </a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
