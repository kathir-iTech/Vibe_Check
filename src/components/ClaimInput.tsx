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
  activeId?: string;
  onSelectPreset: (preset: ScenarioPreset) => void;
}

const SHORT_LABELS: Record<string, { title: string; tag: string }> = {
  "mixed-3-verdict": { title: "1. Three-Verdict Flagship Audit", tag: "TRUE · UNVERIFIED · DRIFT" },
  "inject-agent-lie": { title: "2. Simulate Agent Bluff", tag: "Fake OAuth & Docker" },
  "spec-drift-trap": { title: "3. Spec-Drift Contradiction", tag: "Violates spec.md" },
  "real-pr-url": { title: "4. Live GitHub PR Audit", tag: "TypeScript #64651" },
};

export function ScenarioPresetGrid({ disabled, activeId, onSelectPreset }: PresetGridProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Quick Presets
        </span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          1-click auto-fill
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {SCENARIO_PRESETS.map((preset) => {
          const short = SHORT_LABELS[preset.id] || { title: preset.label, tag: preset.badge };
          const isSelected = activeId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(preset)}
              title={preset.description}
              className={`group flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-500/80 dark:bg-emerald-950/30"
                  : "border-zinc-200 bg-zinc-50/70 hover:border-emerald-500/50 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
              }`}
            >
              <span className="line-clamp-1 text-xs font-semibold text-zinc-900 group-hover:text-emerald-600 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                {short.title}
              </span>
              <span className="mt-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                {short.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
