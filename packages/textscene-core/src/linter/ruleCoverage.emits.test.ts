/**
 * `meta.emits` guard: every rule declares the `ruleName` and severity pairs `check`
 * reports. `armEmits` derives `emits` from the rule's arms (`ruleArms.ts`), and the
 * ESLint rule-arm guard refuses a diagnostic built outside one. The registration
 * half is in `ruleCoverage.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { ruleRegistry } from './RuleRegistry.js';
import {
  allSourceFiles,
  declaredRuleNames,
  nodesRoot,
  ruleFiles,
  srcRoot,
} from './testing/ruleNameScrape.js';
import './index.js';

describe('rule emits meta-guard', () => {
  const allFiles = allSourceFiles();

  it('every registered rule declares a non-empty emits', () => {
    // Without the floor, an empty registry from a failed barrel import reports
    // an empty `undeclared` list and passes.
    expect(ruleRegistry.getRules().length).toBeGreaterThan(100);
    const undeclared = ruleRegistry
      .getRules()
      .filter((r) => !r.meta.emits || r.meta.emits.length === 0)
      .map((r) => r.meta.name)
      .sort();
    expect(undeclared).toEqual([]);
  });

  it("derives every rule's `emits` from its arms", () => {
    // `armEmits` is the one spelling: a hand-written list can name a severity or
    // a rule name that no arm reports.
    const offenders: string[] = [];
    let derived = 0;
    for (const file of allFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const match of src.matchAll(/(?:^|[{,])\s*emits:\s*/gm)) {
        const tail = src.slice(match.index + match[0].length);
        if (tail.startsWith('armEmits(')) derived += 1;
        else offenders.push(`${file.slice(srcRoot.length + 1)}: emits: ${tail.slice(0, 40)}`);
      }
    }
    // Without the floor, a pattern that stops matching reads no `emits` and passes.
    expect(derived).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });

  it('registers exactly one rule per slice linter.ts', () => {
    // `configurationWarningCoverage.test.ts` looks for a rule's cases in the one
    // `linter.test.ts` of its slice. That works only while the slice declares one
    // rule.
    const multiple = ruleFiles()
      .map((f) => ({ f, names: declaredRuleNames(f) }))
      .filter((e) => e.names.length > 1)
      .map((e) => `${e.f.slice(nodesRoot.length + 1)}: ${e.names.join(', ')}`);
    expect(multiple).toEqual([]);
  });

  it('sees a rule in every slice linter.ts, whichever spelling it uses', () => {
    // The guard above bites only on files it reads a rule out of. A factory
    // named differently escapes FACTORY_RULE_RE and leaves the inventory.
    const invisible = ruleFiles()
      .filter((f) => declaredRuleNames(f).length === 0)
      .map((f) => f.slice(nodesRoot.length + 1));
    expect(invisible).toEqual([]);
  });

  it('declares each emitted ruleName once per severity', () => {
    const dupes: string[] = [];
    for (const rule of ruleRegistry.getRules()) {
      const seen = new Set<string>();
      for (const e of rule.meta.emits ?? []) {
        const key = `${e.ruleName}|${e.severity}`;
        if (seen.has(key)) dupes.push(`${rule.meta.name}: ${key}`);
        seen.add(key);
      }
    }
    expect(dupes.sort()).toEqual([]);
  });
});
