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
 *   - An interpolated name is matched as a WILDCARD, so what these assertions
 *     prove about one is that SOME registered rule declares a name of that
 *     shape — never that the instance whose `check` can reach it does. A
 *     dimension-parameterized factory has siblings, and a sibling's own
 *     declaration satisfies the wildcard on behalf of an instance that omits
 *     it: `ShapeCast2D` emitting `shapecast2d-concave-shape` while declaring
 *     only the other four left all 24 assertions green, measured. Nothing here
 *     closes that. `linter/ruleArms.ts` derives both halves from one table, so
 *     `emits` cannot name an arm the table lacks — but an arm whose report site
 *     is gone is still declared and still scraped as reachable, which is what
 *     `ruleArms.test.ts` asks instead.
 *
 * The scrape itself lives in `testing/emitsScrape.ts` and `testing/emitsReach.ts`;
 * the registration and validator halves of the same meta-guard are in
 * `ruleCoverage.test.ts`.
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
  // Derived, never typed out here: every one of these is a claim about the FILE
  // that no `applicableNodeTypes` can reach, and `fileDiagnostics.ts` is where
  // each declares its own severity and citation. A roster kept in this file
  // instead would be the second one to maintain.
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

  it('declares the names each rule-name-builder call actually produces', () => {
    const { builders, unresolvable } = armBuilders(allFiles);

    // Two floors, and they are the whole point. The previous version had none
    // and an early `if (size === 0) return`, on the claim that both populations
    // were legitimately empty — they are not: one builder with two call sites
    // exists today. The generated call-site regex demanded the prefix as the
    // FIRST argument while both call sites pass it second, so the loop below
    // ran zero times and an `uncalled`-only assertion could never see it. Both
    // counts are `> 0` rather than pinned, so an arm becoming a validator bound
    // is not churn.
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
      // Blanked, like the DEFINITION scan: this half read raw source, so a
      // docblock inside a builder's call parens opened a string `scanTopLevel`
      // never closed, and `callRe` matched a call named inside a comment.
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
    // A builder this scrape cannot pin to a call site is NOT thereby exempt.
    // The list used to be empty because the loop `continue`d before anything
    // could reach it, so twelve of the tree's thirteen rule-name builders were
    // dropped in silence and this assertion proved nothing. They cannot be
    // pinned — their names come from a local, or from a helper call — so the
    // question becomes the one that is still answerable: is every template
    // they carry covered by a declared `emits` entry?
    //
    // Answerable, and weaker than it looks: the match is by wildcard against
    // EVERY declared name, so one sibling instantiation declaring the shape
    // answers for all of them. That is why the four dim-parameterized factories
    // derive both halves from one arm table (`ruleArms.ts`) instead of relying
    // on this.
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
    // The hole the wildcard cross-checks above cannot see, closed at the source
    // instead of asserted around: a `...(cond ? […] : [])` inside an `emits`
    // array is a condition `check` must spell a second time, and a name a
    // SIBLING instantiation still declares answers the wildcard on behalf of
    // the instance that omits it. Measured before `ruleArms.ts`: ShapeCast2D
    // emitting `shapecast2d-concave-shape` undeclared left all of the above
    // green. A parameterized rule declares its arms once and derives both
    // halves — see `linter/ruleArms.ts`.
    expect(allFiles.length).toBeGreaterThan(1000);
    const arrays = allFiles.flatMap((f) =>
      emitsArrays(stripComments(readFileSync(f, 'utf8'))).map((body) => ({ file: f, body }))
    );
    // The floor: 100-odd files declare one. Without it a scrape that stopped
    // matching would report "no conditional spread anywhere" about nothing.
    expect(arrays.length).toBeGreaterThan(80);
    const gated = arrays
      .filter(({ body }) => body.includes('...('))
      // `srcRoot`, not `nodesRoot`: this sweep walks all of `src`, and the four
      // factories it polices live under `src/linter/physics`, so a nodes-rooted
      // slice rendered a path that does not exist.
      .map(({ file }) => file.slice(srcRoot.length + 1));
    expect([...new Set(gated)].sort()).toEqual([]);
  });

  it('spells every `emits` as an array literal or `armEmits`', () => {
    // The scrape reads `emits: [ … ]` and strips it so the guard does not
    // validate its own declarations. Any OTHER shape is invisible to both
    // halves: `stripEmits` leaves it in the scraped text and `emitsArrays` never
    // sees inside it, so the cross-checks above pass on whatever it holds. Two
    // spellings are admitted — the array literal they read, and `armEmits`,
    // whose table `ruleArms.test.ts` reads instead, arm by arm, since an arm
    // table spells its names where `stripEmits` does not reach. A third
    // spelling is checked by neither.
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
