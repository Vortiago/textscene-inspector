/**
 * What the linter actually does to one node type, read from the LIVE registries.
 *
 * Two independent families, and the difference matters to a reader:
 *   - **Validators** run during strict parsing, per property. A malformed value
 *     is an `error`; an out-of-range one is an `error` only where Godot's setter
 *     refuses it and a `warning` where only the inspector hint states the bound
 *     (ADR-0032), which is what the `grounding` field carries. They inherit down
 *     the base chain, so a Node3D subclass gets the transform/visible set
 *     without declaring it.
 *   - **Rules** run after parsing. `RuleRegistry` matches the node type exactly,
 *     EXCEPT for a rule carrying an `applicableNodeTypeMatcher` (which is
 *     executed here, not guessed) and a rule declaring no applicable types at
 *     all (which runs for every node).
 *
 * Because matchers are predicates, this can only be computed by running them —
 * which is why the gallery cannot compute it and reads the generated JSON instead.
 */

/**
 * The sheet's `Out of range` cell, from the severity each BOUNDED end reports.
 *
 * Not from `grounding.kind`: that collapses to `enforced` when EITHER end is,
 * so a property with an enforced floor and a hinted ceiling (`extra_cull_margin`)
 * rendered a flat "error" and told the reader exceeding the ceiling stops a
 * build, which it does not. The two ends are named separately whenever they
 * disagree, and an open end is simply absent.
 */
export function outOfRangeCell(tiers) {
  if (!tiers) return '';
  const { min, max } = tiers;
  if (min && max) return min === max ? min : `${min} below, ${max} above`;
  if (min) return `${min} below`;
  return max ? `${max} above` : '';
}

/** Validated properties for `type`, each attributed to the type that declares it. */
export function validatorsFor(type, validatorRegistry, baseTypes) {
  const seen = new Set();
  const out = [];
  // Keys an ancestor declares that THIS type removes (registerUnavailable).
  // Resolved against the leaf, not the declaring type, because the removal
  // lives on the leaf and the declaration lives above it.
  const removed = new Set(validatorRegistry.getUnavailableKeys?.(type) ?? []);
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
      out.push({
        property: key,
        declaredOn: current,
        accepts: validator?.accepts ?? '',
        // What each bounded end actually reports (ADR-0032). Read per end
        // rather than from `grounding.kind`, which cannot express a property
        // whose floor the setter enforces and whose ceiling only the inspector
        // hint states. The tier is the first thing a reader of this table needs,
        // and the sheet used to state it wrongly for every property.
        tiers: validator?.tiers,
        ...(removed.has(key) ? { unavailable: true } : {}),
      });
    }
    current = baseTypes[current];
  }
  // A removal whose declaring ancestor was never reached still belongs in the
  // list: the reader needs to know the key is refused, not merely unlisted.
  for (const key of [...removed].sort()) {
    if (seen.has(key)) continue;
    out.push({ property: key, declaredOn: type, accepts: '', unavailable: true });
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
  // A removal belongs in the type's OWN table even though the key it refuses is
  // declared by an ancestor: refusing it is this type's own statement, and
  // counting it as "inherited from BoxContainer" would say the opposite.
  const own = validators.filter((v) => v.declaredOn === type || v.unavailable);
  const inheritedBy = new Map();
  for (const v of validators) {
    if (v.declaredOn === type || v.unavailable) continue;
    inheritedBy.set(v.declaredOn, (inheritedBy.get(v.declaredOn) ?? 0) + 1);
  }
  const inheritedNote = [...inheritedBy]
    .map(([base, n]) => `${n} inherited from ${base}`)
    .join(', ');

  if (validators.length === 0) {
    lines.push(
      `Strict parsing format-checks nothing here: no validators are registered for \`${type}\`, and it inherits none.`
    );
  } else {
    // A removal is not a check, so a type whose only own entry is a removal must
    // not be described as format-checking it.
    const checked = own.filter((v) => !v.unavailable);
    const refused = own.filter((v) => v.unavailable);
    const scope = checked.length
      ? `these \`${type}\` properties${inheritedNote ? `, plus ${inheritedNote}` : ''}`
      : `the inherited set (${inheritedNote}); \`${type}\` declares none of its own`;
    const refusalNote = refused.length
      ? ` \`${type}\` also REFUSES ${refused
          .map((v) => `\`${v.property}\``)
          .join(', ')}, which its base declares but this class cannot carry.`
      : '';
    lines.push(
      `Strict parsing format-checks ${scope}. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).${refusalNote}`
    );
    if (own.length) {
      lines.push('');
      lines.push('| Property | Accepts | Out of range |');
      lines.push('| --- | --- | --- |');
      for (const v of own) {
        // A removed key is not a property with a narrow domain; it is one this
        // class refuses outright, so it must not read as an accepted value.
        const accepts = v.unavailable ? '**not available on this type**' : v.accepts;
        // Blank for a validator with no bound to exceed: a format-only check has
        // no "out of range", and claiming one would invent a tier it never reports.
        const tier = v.unavailable ? '' : outOfRangeCell(v.tiers);
        lines.push(`| \`${v.property}\` | ${accepts} | ${tier} |`);
      }
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
