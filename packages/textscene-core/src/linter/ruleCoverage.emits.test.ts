/**
 * `meta.emits` drift guard: `emits` declares the `ruleName` values `check`
 * reports, which the sheets' generated Linting chapter lists. The scrape lives in
 * `testing/emitsScrape.ts` and `testing/emitsReach.ts`, and the registration
 * half in `ruleCoverage.test.ts`.
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
import { FILE_DIAGNOSTIC_NAMES } from './fileDiagnostics.js';
import { emitsArrays, pairMatches, scrapePairs } from './testing/emitsScrape.js';
import { armBuilders, balancedGroup, topLevelParts, reachablePairs } from './testing/emitsReach.js';
import { dataOnlyNames, reportedNames } from './testing/emitsReport.js';
import './index.js';

describe('rule emits meta-guard', () => {
  const byRuleName = new Map(ruleRegistry.getRules().map((r) => [r.meta.name, r]));

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
   * The global cross-check, with severity. Per-file equality cannot work: an arm
   * builder spells `${rulePrefix}-negative-energy`, and the physics factories sit
   * outside `src/nodes`. The whole tree at once, `${…}` as a wildcard, needs no
   * skip list.
   */
  const allFiles = allSourceFiles();
  // Derived, never typed out here: each is a claim about the file that no
  // `applicableNodeTypes` reaches, declared with its severity and citation in
  // `fileDiagnostics.ts`.
  const NON_RULE_NAMES = FILE_DIAGNOSTIC_NAMES;
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
    // A scrape that deleted its own population would otherwise pass this, the
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

  it('declares the names each rule-name-builder call actually produces', () => {
    const { builders, unresolvable } = armBuilders(allFiles);

    // Two floors, `> 0` rather than pinned, so an arm becoming a validator
    // bound is not churn. Without them, a call-site regex that expects the prefix
    // in the wrong argument runs the loop zero times and passes.
    expect(builders.size).toBeGreaterThan(0);

    const missing: string[] = [];
    const unresolvedCallSites: string[] = [];
    const called = new Set<string>();
    const callRe = new RegExp(String.raw`\b(${[...builders.keys()].join('|')})\s*\(`, 'g');
    for (const file of ruleFiles()) {
      const owners = declaredRuleNames(file)
        .map((n) => byRuleName.get(n))
        .filter((r) => r !== undefined);
      if (!owners.length) continue;
      // Comments blanked, like the definition scan: an apostrophe in a docblock
      // opens a string `scanTopLevel` never closes, and a call named in a
      // comment is no call.
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const call of src.matchAll(callRe)) {
        const builder = builders.get(call[1]!)!;
        const args = topLevelParts(balancedGroup(src, call.index! + call[0].length - 1));
        const literal = /^'([^']*)'$/.exec(args[builder.index]?.trim() ?? '')?.[1];
        if (literal === undefined) {
          unresolvedCallSites.push(`${file.slice(nodesRoot.length + 1)}: ${call[1]}`);
          continue;
        }
        called.add(call[1]!);
        for (const template of builder.templates) {
          const expected = template.replaceAll(`\${${builder.param}}`, literal);
          const covered = owners.some((r) =>
            (r!.meta.emits ?? []).some((e) => e.ruleName === expected)
          );
          if (!covered) missing.push(`${file.slice(nodesRoot.length + 1)}: ${expected}`);
        }
      }
    }
    expect([...builders.keys()].filter((b) => !called.has(b)).sort()).toEqual([]);
    expect(unresolvedCallSites.sort()).toEqual([]);
    // A builder this scrape cannot pin to a call site is not exempt: every
    // template it carries must match a declared `emits` entry. The match is a
    // wildcard against every name, so a sibling answers for all, which is why
    // the dim-parameterised factories derive both halves in `ruleArms.ts`.
    const declaredNames = ruleRegistry.getRules().flatMap((r) => (r.meta.emits ?? []).map((e) => e.ruleName));
    const uncovered = unresolvable
      .flatMap(({ builder, templates }) =>
        templates
          .map((t) => t.replace(/\$\{[^}]+\}/g, '*'))
          .filter((pattern) => !declaredNames.some((name) => pairMatches(pattern, name)))
          .map((pattern) => `${builder}: ${pattern}`)
      )
      .sort();
    expect(unresolvable.length).toBeGreaterThan(0);
    expect([...new Set(uncovered)]).toEqual([]);
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  it('gates no emits entry on a condition `check` would have to repeat', () => {
    // A `...(cond ? […] : [])` in `emits` is a condition `check` must repeat,
    // and a sibling's declaration answers the wildcard for the instance that
    // omits it. A parameterised rule declares its arms once instead, in
    // `linter/ruleArms.ts`.
    expect(allFiles.length).toBeGreaterThan(1000);
    const arrays = allFiles.flatMap((f) =>
      emitsArrays(stripComments(readFileSync(f, 'utf8'))).map((body) => ({ file: f, body }))
    );
    // Without the floor, a scrape that stopped matching reports "no conditional
    // spread anywhere" about nothing.
    expect(arrays.length).toBeGreaterThan(80);
    const gated = arrays
      .filter(({ body }) => body.includes('...('))
      // `srcRoot`, not `nodesRoot`: this sweep walks all of `src`, and the
      // factories it polices live under `src/linter/physics`.
      .map(({ file }) => file.slice(srcRoot.length + 1));
    expect([...new Set(gated)].sort()).toEqual([]);
  });

  it('spells every `emits` as an array literal or `armEmits`', () => {
    // Any other shape is invisible to both halves: `stripEmits` leaves it in the
    // scraped text and `emitsArrays` never sees inside it. `armEmits` is the one
    // other spelling, since `ruleArms.test.ts` reads its table arm by arm.
    const offenders: string[] = [];
    for (const file of allFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const match of src.matchAll(/(?:^|[{,])\s*emits:\s*/gm)) {
        const tail = src.slice(match.index + match[0].length);
        if (tail.startsWith('[') || tail.startsWith('armEmits(')) continue;
        offenders.push(`${file.slice(srcRoot.length + 1)}: emits: ${tail.slice(0, 40)}`);
      }
    }
    expect(offenders).toEqual([]);
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
    // The guard above bites only on files it reads a rule out of. A factory
    // named differently escapes FACTORY_RULE_RE and leaves the inventory.
    const invisible = ruleFiles()
      .filter((f) => declaredRuleNames(f).length === 0)
      .map((f) => f.slice(nodesRoot.length + 1));
    expect(invisible).toEqual([]);
  });

  it('reads every lookup-table ruleName at a report site', () => {
    // A name in data position vouches for nothing: the scrape reads it whether
    // or not any code pushes it, so the two directions above agree while the
    // diagnostic is unreachable.
    const stranded: string[] = [];
    for (const file of allFiles) {
      const declared = dataOnlyNames(file);
      if (declared.size === 0) continue;
      const reported = reportedNames(file);
      for (const name of declared) {
        if (!reported.has(name)) stranded.push(`${file.slice(srcRoot.length + 1)}: ${name}`);
      }
    }
    expect(stranded.sort()).toEqual([]);
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
