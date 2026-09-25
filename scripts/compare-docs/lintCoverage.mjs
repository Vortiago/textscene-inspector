/**
 * What the linter does to one node type, read from the live registries: validators per property,
 * inherited down the base chain, and rules. A rule matches the type exactly, unless it declares no types
 * (it runs on every node) or an `applicableNodeTypeMatcher` predicate, which only this runs, so the gallery reads the generated JSON.
 */

import { tableLines } from './markdownTable.mjs';

/**
 * The sheet's `Out of range` cell, from the severity each bounded end reports,
 * not from `grounding.kind`, which is `enforced` when either end is. Ends that
 * disagree are named apart, and an open end is absent.
 */
export function outOfRangeCell(tiers, bounds) {
  if (!tiers) return '';
  const { min, max } = tiers;
  // A setter end outside the hint's reports one end at two tiers, which the
  // collapsed wording below cannot say.
  const { enforcedMin, enforcedMax } = bounds ?? {};
  if (enforcedMin || enforcedMax) {
    const parts = [];
    // Where the refusal starts at or above the hint's floor, no value can be
    // below the hint without being refused first, so that band is not named.
    const minReachable = min && bounds?.min !== undefined && (!enforcedMin || enforcedMin.at < bounds.min);
    const maxReachable = max && bounds?.max !== undefined && (!enforcedMax || enforcedMax.at > bounds.max);
    if (enforcedMin) parts.push(`error ${enforcedMin.exclusive ? 'at or below' : 'below'} ${enforcedMin.at}`);
    if (minReachable) parts.push(`${min} below ${bounds.min}`);
    if (maxReachable) parts.push(`${max} above ${bounds.max}`);
    if (enforcedMax) parts.push(`error ${enforcedMax.exclusive ? 'at or above' : 'above'} ${enforcedMax.at}`);
    return parts.join(', ');
  }
  if (min && max) return min === max ? min : `${min} below, ${max} above`;
  if (min) return `${min} below`;
  return max ? `${max} above` : '';
}

/** Validated properties for `type`, each attributed to the type that declares it. */
export function validatorsFor(type, validatorRegistry, baseTypes) {
  const seen = new Set();
  const out = [];
  // Keys an ancestor declares that this type removes (registerUnavailable),
  // resolved against the leaf, where the removal lives.
  const removed = new Set(validatorRegistry.getUnavailableKeys?.(type) ?? []);
  let current = type;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    for (const key of validatorRegistry.getOwnKeys(current).sort()) {
      // A subclass key shadows the base's, exactly as findValidator resolves it.
      if (seen.has(key)) continue;
      seen.add(key);
      // The `v` DSL sets `accepts`. A hand-rolled validator has none and
      // renders blank.
      const validator = validatorRegistry.declarationFor(current, key);
      out.push({
        property: key,
        declaredOn: current,
        accepts: validator?.accepts ?? '',
        // What each bounded end reports (ADR-0032).
        tiers: validator?.tiers,
        // The numbers behind those tiers, for an end that carries two.
        bounds: validator?.bounds,
        ...(removed.has(key) ? { unavailable: true } : {}),
      });
    }
    current = baseTypes[current];
  }
  // A removal whose declaring ancestor was never reached is still listed as
  // refused.
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
 * The `## Linting` body for one node type. `gallery/markdown.mjs`'s `inline()`
 * renders it too, which supports only `` `code` ``, `**bold**` and
 * `[text](href)`: italics reach the page as literal asterisks.
 */
export function renderCoverage(type, coverage) {
  const lines = [];
  const { validators, rules } = coverage;

  // Own properties get a table. Inherited ones get a count per base type,
  // since the sets repeat across every node sharing a base. A removal belongs
  // in the own table: refusing the key is this type's own statement.
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
    // A removal is not a check.
    const checked = own.filter((v) => !v.unavailable);
    const refused = own.filter((v) => v.unavailable);
    const scope = checked.length
      ? `these \`${type}\` properties${inheritedNote ? `, plus ${inheritedNote}` : ''}`
      : `the inherited set (${inheritedNote}); \`${type}\` declares none of its own`;
    // A removal no ancestor declares carries the type itself as `declaredOn`,
    // and must not claim "its base declares".
    const keys = (rows) => rows.map((v) => `\`${v.property}\``).join(', ');
    const shadowed = refused.filter((v) => v.declaredOn !== type);
    const outright = refused.filter((v) => v.declaredOn === type);
    const refusalNote =
      (shadowed.length
        ? ` \`${type}\` also REFUSES ${keys(shadowed)}, which its base declares but this class cannot carry.`
        : '') +
      (outright.length ? ` \`${type}\` also REFUSES ${keys(outright)} outright.` : '');
    lines.push(
      `Strict parsing format-checks ${scope}. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).${refusalNote}`
    );
    if (own.length) {
      lines.push('');
      lines.push(
        ...tableLines(
          ['Property', 'Accepts', 'Out of range'],
          own.map((v) => [
            `\`${v.property}\``,
            // A removed key is refused outright, not a narrow domain.
            v.unavailable ? '**not available on this type**' : v.accepts,
            // Blank for a format-only check, which has no bound to exceed.
            v.unavailable ? '' : outOfRangeCell(v.tiers, v.bounds),
          ])
        )
      );
    }
  }

  lines.push('');

  if (rules.length === 0) {
    lines.push('No semantic lint rules apply to this node type.');
    return lines.join('\n');
  }

  const ruleRows = [];
  for (const rule of rules) {
    const scope = rule.universal ? ' (all nodes)' : rule.viaMatcher ? ' (type-family match)' : '';
    if (rule.emits.length === 0) {
      ruleRows.push([`\`${rule.name}\`${scope}`, '(none)', '(none)']);
      continue;
    }
    // One row per reported name, listing each severity it reports.
    const severitiesByName = new Map();
    for (const e of rule.emits) {
      if (!severitiesByName.has(e.ruleName)) severitiesByName.set(e.ruleName, []);
      severitiesByName.get(e.ruleName).push(e.severity);
    }
    [...severitiesByName].forEach(([ruleName, severities], i) => {
      ruleRows.push([
        i === 0 ? `\`${rule.name}\`${scope}` : '',
        `\`${ruleName}\``,
        severities.join(', '),
      ]);
    });
  }
  lines.push(...tableLines(['Rule', 'Reports', 'Severity'], ruleRows));
  return lines.join('\n');
}
