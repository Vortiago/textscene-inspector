/**
 * Every configuration warning Godot raises is implemented as a rule, or declined.
 *
 * The census the guard reads is `configurationWarningCensus.ts`; its header
 * explains what a row is, how the table was derived, and why the decline
 * categories are typed. This file is only the checking.
 *
 * ## Reaching the leaves is the whole point
 *
 * Godot declares a warning on the class that OWNS the condition, which is often
 * an abstract base - `CollisionObject3D`, `Light3D`, `CSGShape3D`, `XRNode3D`.
 * The types that actually appear in a `.tscn` are its descendants. And
 * `RuleRegistry` applicability is **exact-match by design**
 * (`RuleRegistry.ts:getRulesForNodeType`), so a rule listing
 * `applicableNodeTypes: ['Light3D']` fires for a name no scene file contains and
 * for none of `DirectionalLight3D`/`OmniLight3D`/`SpotLight3D`.
 *
 * So an `implemented` row is not satisfied by the rule merely existing. It is
 * satisfied when the rule reaches EVERY concrete registered type that descends
 * from the declaring class. That is the check this guard exists for; the rest is
 * bookkeeping.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { ruleRegistry } from './RuleRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { descendsFrom } from './nodeBaseTypes.js';
import { WARNINGS, type WarningRow } from './configurationWarningCensus.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its rules
import { ENGINE_CITE_RE } from './testing/engineCite.js';

/**
 * Every row still in the `unimplemented` arm, by declaring class and source
 * line. Named rather than counted: a count says nothing when one gap is fixed
 * and another added in the same edit, and cannot distinguish a gap that became
 * a rule from one quietly re-typed to a decline.
 *
 * Down from 45 in one pass. The one that remains is close to permanent: Godot
 * decides `CSGShape3D`'s empty-or-non-manifold check from the combined boolean
 * brush (`csg_shape.cpp:981`, after `_get_brush()` folds the subtree at
 * `:453-511`), which no scene file describes. A narrower rule for a CSG leaf's
 * OWN degenerate geometry ships beside it, but that is a different condition
 * and is deliberately not credited to this row.
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

  // A `get_configuration_warnings()` entry is advisory BY CONSTRUCTION: Godot
  // shows it in the editor dock and loads the scene regardless, so ADR-0032
  // puts every one of them at `warning` and none at `error`. That needs no
  // per-row data — it follows from the row being in this table at all.
  //
  // Without this, a row could claim `implemented` while its rule reported at a
  // tier the engine never justifies. PathFollow2D did exactly that, keeping
  // `error` after the PathFollow3D sibling was corrected, and every existing
  // check here passed: the rule existed, emitted the name and reached the type.
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
    // The IDENTITIES, not a count. A bare integer cannot tell "a gap became a
    // rule" from "a gap was quietly re-typed to a decline", and says nothing at
    // all when one row is fixed while another is added in the same edit.
    // Pinning the `at` values makes every one of those show up as a diff here.
    const outstanding = Object.entries(WARNINGS)
      .flatMap(([cls, rows]) =>
        rows.filter((r) => 'unimplemented' in r.verdict).map((r) => `${cls} ${r.at}`)
      )
      .sort();
    expect(outstanding).toEqual(UNIMPLEMENTED_ROWS);
  });
});
