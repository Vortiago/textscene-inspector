/**
 * `meta.emits` drift guard.
 *
 * `meta.name` is the registry key; the `ruleName` values a user actually sees are
 * string literals inside `check`. `emits` declares them so the comparison sheets'
 * generated Linting chapter can enumerate them. This keeps the declaration honest.
 *
 * What can and cannot be checked statically:
 *   - Every literal `ruleName: '…'` in a file MUST appear in that rule's `emits`.
 *     This is the direction that catches a forgotten name.
 *   - The reverse (no invented entries) is only checkable for files that emit
 *     their diagnostics directly. A file routing through `rangeAdvisories`, a
 *     shared arm builder, or a physics factory names its diagnostics by
 *     interpolation in ANOTHER file, so its real names are absent here — those
 *     files are exempt from the reverse check rather than pretending coverage.
 *
 * The scrape itself lives in `testing/emitsScrape.ts` and `testing/emitsReach.ts`;
 * the registration and validator halves of the same meta-guard are in
 * `ruleCoverage.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ruleRegistry } from './RuleRegistry.js';
import {
  allSourceFiles,
  declaredRuleNames,
  nodesRoot,
  ruleFiles,
} from './testing/ruleNameScrape.js';
import { pairMatches, scrapePairs } from './testing/emitsScrape.js';
import { armBuilderSuffixes, reachablePairs } from './testing/emitsReach.js';
import './index.js';

describe('rule emits meta-guard', () => {
  const byRuleName = new Map(ruleRegistry.getRules().map((r) => [r.meta.name, r]));

  it('every registered rule declares a non-empty emits', () => {
    // 121 rules register today. Without the floor an empty registry — a failed
    // barrel import — reports an empty `undeclared` list and passes.
    expect(ruleRegistry.getRules().length).toBeGreaterThan(100);
    const undeclared = ruleRegistry
      .getRules()
      .filter((r) => !r.meta.emits || r.meta.emits.length === 0)
      .map((r) => r.meta.name)
      .sort();
    expect(undeclared).toEqual([]);
  });

  it('every literal ruleName in a slice is declared by that slice rule', () => {
    const files = ruleFiles();
    expect(files.length).toBeGreaterThan(100);
    const missing: string[] = [];
    for (const file of files) {
      const owners = declaredRuleNames(file);
      const emitted = scrapePairs(file).map((p) => p.name);
      for (const owner of owners) {
        const rule = byRuleName.get(owner);
        if (!rule) continue;
        const declared = (rule.meta.emits ?? []).map((e) => e.ruleName);
        for (const name of emitted) {
          if (!declared.some((d) => pairMatches(name, d))) missing.push(`${owner}: ${name}`);
        }
      }
    }
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  /**
   * The global cross-check. Per-file equality cannot work: a slice declares
   * `omnilight3d-negative-energy` while the name is built in a shared arm builder
   * as `${rulePrefix}-negative-energy`, and the physics factories live outside
   * `src/nodes` entirely. Comparing the whole tree at once — with `${…}` treated
   * as a wildcard — covers both without a skip list, and checks severity, which
   * nothing else did.
   */
  const allFiles = allSourceFiles();
  // `strict-parser` is not a rule emission: Linter.ts stamps it on Phase-1 parse
  // errors, which come from the validator side and belong to no LintRule.
  const NON_RULE_NAMES = new Set(['strict-parser']);
  const codePairs = allFiles
    .flatMap((f) => scrapePairs(f))
    .filter((p) => !NON_RULE_NAMES.has(p.name));

  /** meta.name -> the slice file declaring it. */
  const fileByRuleName = new Map<string, string>();
  for (const file of ruleFiles()) {
    for (const name of declaredRuleNames(file)) fileByRuleName.set(name, file);
  }

  it('declares no ruleName its own code cannot emit', () => {
    expect(fileByRuleName.size).toBeGreaterThan(100);
    const invented: string[] = [];
    for (const rule of ruleRegistry.getRules()) {
      const file = fileByRuleName.get(rule.meta.name);
      if (!file) continue;
      const reachable = reachablePairs(file);
      for (const e of rule.meta.emits ?? []) {
        const found = reachable.some(
          (p) => pairMatches(p.name, e.ruleName) && p.severity === e.severity
        );
        if (!found) invented.push(`${rule.meta.name}: ${e.ruleName} (${e.severity})`);
      }
    }
    expect(invented.sort()).toEqual([]);
  });

  it('declares every ruleName the source emits', () => {
    // The swept tree yields 269 pairs today. A scrape that desynced and
    // deleted its own population would otherwise pass this silently — the exact
    // failure the bracket-matched `emits` strip exists to avoid.
    expect(allFiles.length).toBeGreaterThan(1000);
    expect(codePairs.length).toBeGreaterThan(200);
    const declared = ruleRegistry.getRules().flatMap((r) => r.meta.emits ?? []);
    const undeclared = codePairs
      .filter(
        (p) => !declared.some((e) => pairMatches(p.name, e.ruleName) && e.severity === p.severity)
      )
      .map((p) => `${p.name} (${p.severity})`);
    expect([...new Set(undeclared)].sort()).toEqual([]);
  });

  it('declares the names each arm-builder call actually produces', () => {
    const armSuffixes = armBuilderSuffixes(allFiles);

    // Anti-vacuity, tied to reality rather than to a floor. Every advisory arm
    // that interpolated its rule prefix has since become a validator bound, so
    // the population is legitimately empty and a count would only measure how
    // far that conversion got. What must stay true is that no arm builder
    // escapes BOTH scrapes: one whose names are interpolated belongs here, and
    // one whose names are literal is already covered by the literal scrape
    // above. This is trivially satisfied at zero and bites the moment a builder
    // is added whose names this scrape cannot resolve.
    const unresolvable: string[] = [];
    for (const file of allFiles) {
      const src = readFileSync(file, 'utf8');
      for (const fn of src.matchAll(/export function (\w+Arms)\(/g)) {
        const builder = fn[1]!;
        if (armSuffixes.has(builder)) continue;
        const end = src.indexOf('\n}', fn.index!);
        const body = src.slice(fn.index!, end === -1 ? undefined : end);
        // A bare identifier or quoted string reaches the literal scrape; a
        // template does not, and one this scrape could not resolve either is
        // a name nothing checks.
        if (!/ruleName:\s*`/.test(body)) continue;
        unresolvable.push(builder);
      }
    }
    expect(unresolvable.sort()).toEqual([]);

    const missing: string[] = [];
    for (const file of ruleFiles()) {
      const owners = declaredRuleNames(file)
        .map((n) => byRuleName.get(n))
        .filter((r) => r !== undefined);
      if (!owners.length) continue;
      const src = readFileSync(file, 'utf8');
      for (const call of src.matchAll(/(\w+Arms)\(\s*'([^']+)'/g)) {
        const [, builder, prefix] = call;
        for (const suffix of armSuffixes.get(builder!) ?? []) {
          const expected = `${prefix}${suffix}`;
          const covered = owners.some((r) =>
            (r!.meta.emits ?? []).some((e) => e.ruleName === expected)
          );
          if (!covered) missing.push(`${file.slice(nodesRoot.length + 1)}: ${expected}`);
        }
      }
    }
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  it('registers exactly one rule per slice linter.ts', () => {
    // The per-slice check attributes every scraped name to every rule declared in
    // the file, which is only sound while that is one rule. Assert the assumption
    // rather than leaving a second rule to produce an unfixable red test.
    const multiple = ruleFiles()
      .map((f) => ({ f, names: declaredRuleNames(f) }))
      .filter((e) => e.names.length > 1)
      .map((e) => `${e.f.slice(nodesRoot.length + 1)}: ${e.names.join(', ')}`);
    expect(multiple).toEqual([]);
  });

  it('sees a rule in every slice linter.ts, whichever spelling it uses', () => {
    // The guard above can only bite on files it can read a rule out of. If a
    // future factory is named differently, FACTORY_RULE_RE stops matching and
    // that slice silently leaves the inventory — so assert the scrape finds
    // something everywhere, which is what makes the count meaningful.
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
