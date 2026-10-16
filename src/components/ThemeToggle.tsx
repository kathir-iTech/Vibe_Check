"use client";
import { useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextDark);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode (2am builder mode)"}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-zinc-800 transition-colors hover:border-emerald-500/40 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-emerald-400"
    >
      <span aria-hidden="true">{dark ? "🌙" : "☀️"}</span>
      <span>{dark ? "2am Dark" : "Light"}</span>
    </button>
  );
}
