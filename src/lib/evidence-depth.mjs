// Conservative source checks. These bound model conclusions; they never turn
// a model rejection into support or claim to prove execution.
const CODE = /\.(?:[cm]?[jt]sx?|py|go|rs|java|rb|php)$/i;
const PRESENCE =
  /\b(?:exists?|declares?|declaration|defined|definition|imports?|dependency|dependencies|listed|exports?)\b/i;

export function isDeclarationPresence(claim, line, file) {
  if (!CODE.test(file)) return false;
  const declaration = String(line)
    .trim()
    .match(
      /^(?:(?:export|default|async|public|static)\s+)*(?:function|def|class)\s+([A-Za-z_$][\w$]*)\b/,
    );
  const assertion = String(claim)
    .trim()
    .match(
      /^(?:An?|The)\s+([A-Za-z_$][\w$]*)\s+(?:function|class)\s+(?:exists?|is\s+(?:defined|declared))\.?$/i,
    );
  return Boolean(declaration && assertion && declaration[1] === assertion[1]);
}

export function splitClaimText(value) {
  const text = String(value || "").trim();
  // Split only explicit independent predicates. Preserve noun lists and
  // negated/conditional sentences rather than inventing positive claims.
  if (/\b(?:not|never|without|if|unless)\b/i.test(text)) return [text];
  return text
    .split(
      /\s+(?:and|also)\s+(?=(?:added|implemented|created|configured|protected|enabled|removed|fixed|deployed|all\s+\w+\s+(?:tests|passed)|all\s+tests|the\s+(?:app|application)\s+is)\b)/i,
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

export function sourceSupportCheck(claim, file, text, line) {
  const quote =
    String(text || "")
      .split("\n")
      [line - 1]?.trim() || "";
  const result = (ceiling, kind, note) => ({ ceiling, kind, note });
  if (!quote)
    return result("none", "missing", "The cited source line is unavailable.");
  if (/\.(?:md|mdx|txt)$/i.test(file) || /(?:^|\/)README(?:\.|$)/i.test(file))
    return result(
      "none",
      "documentation",
      "Documentation describes behavior; it does not establish implementation.",
    );
  if (splitClaimText(claim).length > 1)
    return result(
      "partial",
      "compound",
      "This claim has independent obligations. Split it before relying on full support.",
    );

  if (/(?:^|\/)package\.json$/i.test(file)) {
    let manifest;
    try {
      manifest = JSON.parse(text);
    } catch {
      return result(
        "partial",
        "unparsed-manifest",
        "The bounded manifest could not be parsed completely.",
      );
    }
    const entry = quote.match(/^"([^"\\]+)"\s*:\s*"([^"\\]*)"\s*,?$/);
    if (entry) {
      const [, key, value] = entry;
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namesKey =
        new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(
          claim,
        ) ||
        (key === "next" && /\bnext\.js\b/i.test(claim));
      if (
        key === "license" &&
        manifest.license === value &&
        /\blicen[cs]/i.test(claim)
      ) {
        const licenseToken = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (
          !new RegExp(
            `(?:^|[^a-z0-9_.+-])${licenseToken}(?:$|[^a-z0-9_.+-])`,
            "i",
          ).test(String(claim))
        )
          return result(
            "none",
            "manifest-value",
            "The cited license value does not establish the claimed license.",
          );
        return result(
          "full",
          "manifest-value",
          "Parsed manifest license declaration; licensing obligations are not assessed.",
        );
      }
      const section = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ].find(
        (name) =>
          Object.hasOwn(manifest[name] || {}, key) &&
          manifest[name][key] === value,
      );
      if (section) {
        if (!namesKey)
          return result(
            "none",
            "different-dependency",
            "This manifest entry names a different dependency from the claim.",
          );
        if (!/\b(?:dependenc(?:y|ies)|declared|listed|manifest)\b/i.test(claim))
          return result(
            "partial",
            "dependency-only",
            "A declared dependency does not establish that the feature is connected or works.",
          );
        const version = String(claim).match(
          /\b(?:version\s*|v)(\d+(?:\.\d+){0,2})\b/i,
        )?.[1];
        if (
          version &&
          !new RegExp(`^\\D*${version.replace(/\./g, "\\.")}(?:\\D|$)`).test(
            value,
          )
        )
          return result(
            "none",
            "manifest-value",
            "The dependency declaration does not match the claimed version.",
          );
        return result(
          "full",
          "dependency-declaration",
          `Parsed ${section} declaration only; installation and execution are not established.`,
        );
      }
    }
    return result(
      "partial",
      "manifest-only",
      "A manifest line alone does not establish application behavior.",
    );
  }

  if (CODE.test(file)) {
    const importOnly =
      /^(?:import\b|(?:const|let|var)\s+.*=\s*require\s*\()/i.test(quote);
    const declarationOnly =
      /^(?:(?:export|default|async|public|private|static)\s+)*(?:function|class|interface|type|def|fn)\b/.test(
        quote,
      ) &&
      (!/\{.+\}/.test(quote) || /\{\s*\}/.test(quote));
    const constantOnly =
      /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:["'`]|true\b|false\b)/.test(
        quote,
      );
    if (
      (importOnly || declarationOnly || constantOnly) &&
      !PRESENCE.test(claim)
    )
      return result(
        "partial",
        importOnly ? "import-only" : "declaration-only",
        "The cited declaration does not establish the promised behavior or its call path.",
      );
    if (
      /\b(?:all|every|fully|complete(?:ly)?|secure|production.ready)\b/i.test(
        claim,
      ) &&
      !PRESENCE.test(claim)
    )
      return result(
        "partial",
        "scope-limit",
        "A single source line cannot establish this claim's complete or universal scope.",
      );
    return result(
      "full",
      "source-line",
      "Exact source support; reachability and execution remain outside this check.",
    );
  }
  return result(
    "full",
    "configuration-line",
    "Exact source declaration; runtime behavior is not established.",
  );
}

// A literal review restriction on a parsed manifest value, not a legal-license
// analysis. Deliberately excludes repository prose, examples and conditional rules.
export function explicitLicenseConflict(file, source, docs) {
  if (!/(?:^|\/)package\.json$/i.test(file)) return null;
  let license;
  try {
    license = JSON.parse(source).license;
  } catch {
    return null;
  }
  if (typeof license !== "string" || !/^[a-z0-9.+-]{1,64}$/i.test(license))
    return null;
  const doc = docs.find(
    (entry) =>
      entry.file === "provided-requirements.md" && entry.provided === true,
  );
  if (!doc) return null;
  let fence = null;
  const lines = doc.text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const marker = line.replace(/^[-*]\s+/, "").match(/^(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (
        marker[1][0] === fence.char &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null;
      continue;
    }
    if (fence) continue;
    const rule = line.match(
      /^(?:[-*]\s+|\d+[.)]\s+)?([a-z0-9.+-]{1,64})\s+(?:licensing|licenses?)\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|not allowed)\.?$/i,
    );
    if (rule && rule[1].toLowerCase() === license.toLowerCase())
      return {
        file: doc.file,
        line: index + 1,
        quote: line,
        license,
      };
  }
  return null;
}

export function evidenceContract(finding) {
  const runtime = ["execution", "runtime"].includes(finding.obligation);
  return {
    checked: runtime
      ? "Source and separately attributed records; no repository code executed."
      : "Bounded source inspection at the recorded commit.",
    established:
      finding.verdict === "UNVERIFIED"
        ? "No sufficient source support established."
        : finding.verdict === "SPEC-DRIFT"
          ? "Cited source support conflicts with a cited planning requirement."
          : finding.verdict === "PARTIAL"
            ? "Only part of the claim has source support."
            : "The cited source supports this bounded claim.",
    unknown: runtime
      ? "The claimed execution or deployment outcome is not certified."
      : "Uninspected files, execution and complete behavior are not established.",
    resolve:
      finding.nextEvidence ||
      "Narrow the claim or inspect additional source evidence.",
  };
}
