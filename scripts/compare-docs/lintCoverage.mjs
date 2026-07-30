/**
 * What the linter actually does to one node type, read from the LIVE registries.
 *
 * Two independent families, and the difference matters to a reader:
 *   - **Validators** run during strict parsing, per property, and are always
 *     `error`. They inherit down the base chain, so a Node3D subclass gets the
 *     transform/visible set without declaring it.
 *   - **Rules** run after parsing. `RuleRegistry` matches the node type exactly,
 *     EXCEPT for a rule carrying an `applicableNodeTypeMatcher` (which is
 *     executed here, not guessed) and a rule declaring no applicable types at
 *     all (which runs for every node).
 *
 * Because matchers are predicates, this can only be computed by running them —
 * which is why the gallery cannot compute it and reads the generated JSON instead.
 */

/** Validated properties for `type`, each attributed to the type that declares it. */
export function validatorsFor(type, validatorRegistry, baseTypes) {
  const seen = new Set();
  const out = [];
  let current = type;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    for (const key of validatorRegistry.getOwnKeys(current).sort()) {
      // A subclass key shadows the base's, exactly as findValidator resolves it.
      if (seen.has(key)) continue;
      seen.add(key);
      // `accepts` is set by the `v` DSL at construction time, where the bounds
      // are known. A hand-rolled validator has none and renders blank rather
      // than being guessed at.
      const validator = validatorRegistry.findValidator(current, key);
      out.push({ property: key, declaredOn: current, accepts: validator?.accepts ?? '' });
    }
    current = baseTypes[current];
  }
  return out;
}

/** Semantic rules that reach `type`, with the diagnostics each can report. */
export function rulesFor(type, ruleRegistry) {
  return ruleRegistry.getRulesForNodeType(type).map((rule) => ({
    name: rule.meta.name,
    description: rule.meta.description,
    // A rule with neither applicableNodeTypes nor a matcher runs everywhere.
    universal: !rule.meta.applicableNodeTypes?.length && !rule.meta.applicableNodeTypeMatcher,
    viaMatcher: Boolean(rule.meta.applicableNodeTypeMatcher),
    emits: (rule.meta.emits ?? []).map((e) => ({ ...e })),
  }));
}

export function coverageFor(type, { ruleRegistry, validatorRegistry, baseTypes }) {
  return {
    validators: validatorsFor(type, validatorRegistry, baseTypes),
    rules: rulesFor(type, ruleRegistry),
  };
}

/**
 * The `## Linting` body for one node type. Terse: this is an index, not prose.
 *
 * The output is rendered twice — as Markdown in the sheet, and by
 * `build-gallery.mjs`'s `inline()` in the gallery. That renderer supports only
 * `` `code` ``, `**bold**` and `[text](href)`, so stay inside that subset;
 * anything else (italics especially) reaches the page as literal asterisks.
 */
export function renderCoverage(type, coverage) {
  const lines = [];
  const { validators, rules } = coverage;

  // Own properties get a table; inherited ones get a count per base type. The
  // inherited sets are identical across every node sharing a base (all 34 of a
  // light's validated properties are 31 Node3D/Light3D ones), so listing them in
  // full would repeat one table across dozens of sheets to no purpose.
  const own = validators.filter((v) => v.declaredOn === type);
  const inheritedBy = new Map();
  for (const v of validators) {
    if (v.declaredOn === type) continue;
    inheritedBy.set(v.declaredOn, (inheritedBy.get(v.declaredOn) ?? 0) + 1);
  }
  const inheritedNote = [...inheritedBy]
    .map(([base, n]) => `${n} inherited from ${base}`)
    .join(', ');

  if (validators.length === 0) {
    lines.push(
      `Strict parsing format-checks nothing on this node: no validators are registered for \`${type}\`, and it inherits none.`
    );
  } else {
    const scope = own.length
      ? `these \`${type}\` properties${inheritedNote ? `, plus ${inheritedNote}` : ''}`
      : `the inherited set (${inheritedNote}); \`${type}\` declares none of its own`;
    lines.push(`Strict parsing format-checks ${scope}. Every validator failure is an **error**.`);
    if (own.length) {
      lines.push('');
      lines.push('| Property | Accepts |');
      lines.push('| --- | --- |');
      for (const v of own) lines.push(`| \`${v.property}\` | ${v.accepts} |`);
    }
  }

  lines.push('');

  if (rules.length === 0) {
    lines.push('No semantic lint rules apply to this node type.');
    return lines.join('\n');
  }

  lines.push('| Rule | Reports | Severity |');
  lines.push('| --- | --- | --- |');
  for (const rule of rules) {
    const scope = rule.universal ? ' (all nodes)' : rule.viaMatcher ? ' (type-family match)' : '';
    if (rule.emits.length === 0) {
      lines.push(`| \`${rule.name}\`${scope} | (none) | (none) |`);
      continue;
    }
    // One row per reported name; a name reported at both severities lists both
    // rather than occupying two rows.
    const severitiesByName = new Map();
    for (const e of rule.emits) {
      if (!severitiesByName.has(e.ruleName)) severitiesByName.set(e.ruleName, []);
      severitiesByName.get(e.ruleName).push(e.severity);
    }
    [...severitiesByName].forEach(([ruleName, severities], i) => {
      lines.push(
        `| ${i === 0 ? `\`${rule.name}\`${scope}` : ''} | \`${ruleName}\` | ${severities.join(', ')} |`
      );
    });
  }
  return lines.join('\n');
}
