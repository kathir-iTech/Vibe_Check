export type StageTimings = Record<string, number>;

export function createTimings() {
  const start = performance.now();
  let last = start;
  const stages: StageTimings = {};

  return {
    lap(stage: string) {
      const now = performance.now();
      stages[stage] = Math.round(now - last);
      last = now;
    },
    set(stage: string, ms: number) {
      stages[stage] = Math.round(ms);
    },
    finish(): StageTimings {
      stages.total = Math.round(performance.now() - start);
      return { ...stages };
    },
  };
}

export function serverTimingHeader(timings: StageTimings): string {
  return Object.entries(timings)
    .map(([name, dur]) => `${name};dur=${dur}`)
    .join(", ");
}
