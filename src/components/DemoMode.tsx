"use client";
import { useState } from "react";

export function DemoMode() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setLoaded(true)}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Load Demo Data
      </button>
      {loaded && (
        <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Demo Verdicts
          </h3>
          <p>
            Claim: &quot;I added authentication and all tests pass&quot; &#8594; UNVERIFIED
            (sample data)
          </p>
          <p>
            Claim: &quot;I implemented the user profile page&quot; &#8594; UNVERIFIED (sample
            data)
          </p>
          <p>Claim: &quot;I refactored the API client&quot; &#8594; TRUE (sample data)</p>
        </div>
      )}
    </div>
  );
}
