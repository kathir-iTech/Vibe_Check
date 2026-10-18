import { isImplementationLineAt } from "./verification-guards.mjs";

// Search hits guide inspection; support still requires independent validation.
export function sourceWindow(file, source, claim = "") {
  const manifest = /(?:^|\/)package\.json$/i.test(file);
  const budget = manifest ? 64 * 1024 : 20 * 1024;
  const lines = source.split("\n");
  const ignored = new Set([
    "function",
    "functions",
    "defined",
    "definition",
    "exists",
    "class",
    "declares",
    "dependency",
    "dependencies",
    "licensing",
    "package",
    "implemented",
    "added",
    "every",
    "fully",
    "against",
    "source",
    "complete",
    "protected",
  ]);
  const terms = [
    ...new Set(
      (String(claim).match(/[a-zA-Z_][a-zA-Z0-9_$]*/g) || []).filter(
        (t) => t.length >= 4 && !ignored.has(t.toLowerCase()),
      ),
    ),
  ];
  let anchor = 0;
  if (!manifest && source.length > budget && terms.length) {
    let best = 0;
    lines.forEach((line, i) => {
      const hits = terms.filter((t) => line.includes(t));
      if (!hits.length) return;
      const declaration =
        /\b(?:def|function|class|const|let|fn)\s+|\w+\.\w+\s*=\s*function/.test(
          line,
        );
      const score =
        hits.reduce((n, t) => n + Math.min(t.length, 12), 0) +
        (declaration ? 8 : 0);
      if (score > best) {
        best = score;
        anchor = Math.max(0, i - 8);
      }
    });
  }
  let length = 0;
  const selected = [];
  for (let i = anchor; i < lines.length; i++) {
    if (length + lines[i].length + 1 > budget) break;
    selected.push(lines[i]);
    length += lines[i].length + 1;
  }
  const nonImplementationLines = manifest
    ? []
    : selected.flatMap((_, i) =>
        isImplementationLineAt(source, anchor + i + 1, file)
          ? []
          : [anchor + i + 1],
      );
  return {
    file,
    text: selected.join("\n"),
    startLine: anchor + 1,
    truncated: anchor > 0 || selected.length < lines.length,
    nonImplementationLines,
  };
}
