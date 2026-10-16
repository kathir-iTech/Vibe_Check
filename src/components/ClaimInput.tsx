"use client";
import { Claim } from "@/types";
import { SCENARIO_PRESETS, type ScenarioPreset } from "@/lib/demo-data";

export function formatClaimText(claim: Claim): string {
  return claim.text;
}

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case "TRUE":
      return "#22c55e";
    case "UNVERIFIED":
      return "#ef4444";
    case "SPEC-DRIFT":
      return "#f59e0b";
    default:
      return "#666";
  }
}

interface PresetGridProps {
  disabled?: boolean;
  onSelectPreset: (preset: ScenarioPreset) => void;
}

export function ScenarioPresetGrid({ disabled, onSelectPreset }: PresetGridProps) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Quick-Start Test Scenarios
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Click any scenario to auto-fill the inspector
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SCENARIO_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPreset(preset)}
            className="group flex flex-col items-start rounded-lg border border-zinc-200 bg-zinc-50/80 p-2.5 text-left transition-colors hover:border-emerald-500/60 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/20"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-300">
                {preset.label}
              </span>
              <span className="shrink-0 rounded bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                {preset.badge}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {preset.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
