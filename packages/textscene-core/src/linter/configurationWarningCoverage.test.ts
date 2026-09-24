/**
 * Every configuration warning Godot raises is implemented as a rule, or declined (`configurationWarningCensus.ts`).
 * Godot declares a warning on the class that owns the condition, often an abstract base such as `Light3D`, and
 * `RuleRegistry.getRulesForNodeType` matches exactly. So an implemented row passes only when its rule reaches every
 * concrete registered type descending from the declaring class, not when the rule merely exists.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { ruleRegistry } from './RuleRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { WARNINGS, type WarningRow } from './configurationWarningCensus.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its rules
import { ENGINE_CITE_RE } from './testing/engineCite.js';
import { declaredRuleNames, ruleFiles } from './testing/ruleNameScrape.js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Every row still `unimplemented`, by declaring class and line, named rather than counted. The remaining one is close
 * to permanent: Godot decides `CSGShape3D`'s empty-or-non-manifold check from the combined brush (`csg_shape.cpp:981`,
 * after `_get_brush()` folds the subtree at `:453-511`), which no scene file describes. The rule for a CSG leaf's own
 * degenerate geometry is a different condition and is not credited to this row.
 */
const UNIMPLEMENTED_ROWS: readonly string[] = ['CSGShape3D csg_shape.cpp:982'];

/** Concrete, registered types a row applies to. */
function concreteHeirs(declaringClass: string, row?: WarningRow): string[] {
  const registered = nodeRegistry.getAllTypeNames();
  if (row?.appliesTo) return registered.filter((t) => row.appliesTo!.includes(t));
  return registered.filter((t) => t === declaringClass || descendsFrom(t, declaringClass));
}

function rulesEmitting(ruleName: string) {
  return ruleRegistry.getRules().filter((r) => r.meta.emits?.some((e) => e.ruleName === ruleName));
}

describe('Godot configuration-warning coverage', () => {
  it('every implemented row names a rule that actually emits it', () => {
    const missing: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('rule' in row.verdict)) continue;
        if (rulesEmitting(row.verdict.rule).length === 0) {
          missing.push(`${cls} ${row.at} claims '${row.verdict.rule}', which no registered rule emits`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  // A `get_configuration_warnings()` entry is advisory by construction: Godot shows it in the editor dock and loads the
  // scene, so ADR-0032 puts every one at `warning`. Without this, a row could claim `implemented` while its rule
  // reported at `error` and every other check here passed.
  it('every implemented row is reported at warning, never error', () => {
    const miscased: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('rule' in row.verdict)) continue;
        const ruleName = row.verdict.rule;
        for (const owner of rulesEmitting(ruleName)) {
          const emitted = owner.meta.emits?.find((e) => e.ruleName === ruleName);
          if (emitted && emitted.severity !== 'warning') {
            miscased.push(
              `${cls} ${row.at} '${ruleName}' is declared '${emitted.severity}' by ${owner.meta.name}; a configuration warning is advisory (ADR-0032)`
            );
          }
        }
      }
    }
    expect(miscased).toEqual([]);
  });

  it('every implemented row reaches every concrete heir of its declaring class', () => {
    const gaps: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('rule' in row.verdict)) continue;
        const heirs = concreteHeirs(cls, row);
        const owners = rulesEmitting(row.verdict.rule);
        const unreached = heirs.filter(
          (t) => !ruleRegistry.getRulesForNodeType(t).some((r) => owners.includes(r))
        );
        if (unreached.length > 0) {
          gaps.push(`${cls} ${row.at} '${row.verdict.rule}' never runs on ${unreached.join(', ')}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('every appliesTo entry names a registered type', () => {
    // `concreteHeirs` filters the registry BY the list, so a misspelt entry
    // yields no heirs and the reach check above passes over nothing.
    const registered = new Set(nodeRegistry.getAllTypeNames());
    const unknown = Object.entries(WARNINGS).flatMap(([cls, rows]) =>
      rows.flatMap((row) =>
        (row.appliesTo ?? []).filter((t) => !registered.has(t)).map((t) => `${cls} ${row.at}: '${t}'`)
      )
    );
    expect(unknown).toEqual([]);
  });

  it('every declaring class is reachable from a registered type', () => {
    const orphans = Object.keys(WARNINGS).filter((cls) => concreteHeirs(cls).length === 0);
    expect(orphans).toEqual([]);
  });

  it('every validator-covered row names a validator that resolves', () => {
    const missing: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('validator' in row.verdict)) continue;
        const [type = '', key = ''] = row.verdict.validator.split('.');
        if (!validatorRegistry.findValidator(type, key)) {
          missing.push(`${cls} ${row.at} points at ${row.verdict.validator}, which resolves nothing`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every decline gives a reason that cites the engine', () => {
    const thin: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('declined' in row.verdict)) continue;
        if (!ENGINE_CITE_RE.test(row.verdict.because)) {
          thin.push(`${cls} ${row.at}: "${row.verdict.because}" cites no source line`);
        }
      }
    }
    expect(thin).toEqual([]);
  });

  it('names exactly the rows still outstanding, not merely how many', () => {
    // The identities, not a count: pinning the `at` values shows a gap that became a rule, a gap re-typed to a
    // decline, and one row fixed while another is added, each as a diff here.
    const outstanding = Object.entries(WARNINGS)
      .flatMap(([cls, rows]) =>
        rows.filter((r) => 'unimplemented' in r.verdict).map((r) => `${cls} ${r.at}`)
      )
      .sort();
    expect(outstanding).toEqual(UNIMPLEMENTED_ROWS);
  });

  it('every gated row is held to a hidden-node case in the slice that emits it', () => {
    // `gate` records that Godot wraps the push_back in a visibility check; the
    // rule reproduces it, and only a hidden-node case in the slice's own test
    // can see it stop reproducing. The column is the record of who owes one.
    const fileByMetaName = new Map<string, string>();
    for (const file of ruleFiles()) for (const name of declaredRuleNames(file)) fileByMetaName.set(name, file);
    const owing: string[] = [];
    for (const [declaring, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!row.gate || !('rule' in row.verdict)) continue;
        for (const rule of rulesEmitting(row.verdict.rule)) {
          const file = fileByMetaName.get(rule.meta.name);
          const test = file ? join(dirname(file), 'linter.test.ts') : undefined;
          const covered = test && existsSync(test) && /visible\s*[:=]\s*false/.test(readFileSync(test, 'utf8'));
          if (!covered) owing.push(`${declaring} ${row.at} → ${rule.meta.name} (${row.gate})`);
        }
      }
    }
    expect(owing).toEqual([]);
  });
});
