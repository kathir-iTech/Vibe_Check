"use client";
import { useEffect, useState } from "react";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(
    () => setDark(document.documentElement.classList.contains("dark")),
    [],
  );
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("vibecheck-theme", next ? "dark" : "light");
    } catch {
      /* preference persistence is optional */
    }
  }
  return (
    <button
      className="theme-button"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      {dark ? "☀" : "☾"}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
