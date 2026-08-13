/**
 * Lint-rule and validator coverage meta-guard.
 *
 * Cross-checks the filesystem against the live registries so a rule or
 * validator can never ship untested or unregistered:
 *
 *   1. Every `linter.ts` under `src/nodes/` has a sibling `linter.test.ts`.
 *   2. The union of rule names declared in those files equals the names in
 *      `ruleRegistry` — catching dead rule files (declared but never
 *      imported by an index.linter.ts) and rules registered outside slices.
 *   3. Every `registerAll('Type', ...)` in a `linterParser.ts` is live in
 *      `validatorRegistry` after importing the linter barrel — catching a
 *      linterParser.ts whose registration never runs.
 *   4. Every registering `linterParser.ts` has a sibling test that
 *      exercises it (imports `./linterParser` directly or lints through
 *      the Linter class). Non-registering shared helpers are exempt.
 *
 * The `meta.emits` drift guard, which reads the same declarations, is the
 * sibling `ruleCoverage.emits.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ruleRegistry } from './RuleRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import {
  declaredRuleNames,
  extractAll,
  linterDir,
  nodesRoot,
  REGISTER_ALL_RE,
  ruleFiles,
  walk,
} from './testing/ruleNameScrape.js';
import './index.js';
import { ENGINE_CITE_RE } from './testing/engineCite.js';

describe('lint rule coverage meta-guard', () => {
  const files = ruleFiles();

  it('every slice linter.ts has a sibling linter.test.ts', () => {
    // The floor is what stops a broken walk from reporting "nothing untested"
    // about a population of zero. 121 slices declare a rule today.
    expect(files.length).toBeGreaterThan(100);
    const untested = files
      .filter((f) => !existsSync(join(dirname(f), 'linter.test.ts')))
      .map((f) => f.slice(nodesRoot.length + 1));
    expect(untested).toEqual([]);
  });

  it('declared rule names match the live ruleRegistry exactly', () => {
    const declared = new Set(files.flatMap(declaredRuleNames));
    const registered = new Set(ruleRegistry.getRules().map((r) => r.meta.name));
    expect(declared.size).toBeGreaterThan(100);

    const declaredButNotRegistered = [...declared].filter((n) => !registered.has(n)).sort();
    const registeredOutsideSlices = [...registered].filter((n) => !declared.has(n)).sort();

    // A name here means a slice's linter.ts exists but is never imported
    // (missing index.linter.ts wiring) — the rule silently does not run.
    expect(declaredButNotRegistered).toEqual([]);
    // A name here means a rule registered from outside src/nodes — rules
    // belong to slices.
    expect(registeredOutsideSlices).toEqual([]);
  });
});

describe('validator coverage meta-guard', () => {
  const parserFiles = walk(nodesRoot, 'linterParser.ts');
  const registering = parserFiles
    .map((f) => ({ file: f, types: extractAll(f, REGISTER_ALL_RE) }))
    .filter((e) => e.types.length > 0);

  it('counts the slices whose whole contribution is a removal', () => {
    // They call `registerUnavailable` and no `registerAll`, so the narrow
    // scrape never visited them and neither of the two sweeps below could see a
    // removal that stopped running.
    expect(registering.flatMap((e) => e.types)).toEqual(
      expect.arrayContaining(['HBoxContainer', 'VSplitContainer', 'VFlowContainer'])
    );
  });

  it('every registered node type is live in validatorRegistry', () => {
    // 241 linterParser.ts files register today; a walk that found none would
    // otherwise report an empty `dead` list and pass.
    expect(registering.length).toBeGreaterThan(200);
    // Removals are registered separately from validators: a fixed-orientation
    // container adds none of its own, so it is absent from
    // `getRegisteredNodeTypes()` while being very much alive.
    const live = new Set([
      ...validatorRegistry.getRegisteredNodeTypes(),
      ...validatorRegistry.getTypesWithRemovals(),
    ]);
    const dead = registering
      .flatMap((e) => e.types.map((t) => ({ t, file: e.file })))
      .filter(({ t }) => !live.has(t))
      .map(({ t, file }) => `${t} (${file.slice(nodesRoot.length + 1)})`);
    // A type here means the linterParser.ts exists but its registration
    // never runs — missing index.linter.ts wiring.
    expect(dead).toEqual([]);
  });

  it('every registering linterParser.ts has a sibling test exercising it', () => {
    const untested: string[] = [];
    for (const { file } of registering) {
      const dir = dirname(file);
      const tests = readdirSync(dir).filter(
        (f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx')
      );
      const exercised = tests.some((t) => {
        const src = readFileSync(join(dir, t), 'utf8');
        return src.includes('./linterParser') || src.includes('/Linter');
      });
      if (!exercised) untested.push(dir.slice(nodesRoot.length + 1));
    }
    expect(untested).toEqual([]);
  });

  it('every exact-class exemption cites an engine guard and needs no matcher', () => {
    // The claim lives on the rule (`RuleMeta.exactClassByDesign`), so a stale
    // one cannot outlive its rule the way a name-keyed list elsewhere could.
    // What still needs checking is that it is a real claim: an engine citation,
    // and no matcher — a rule with a matcher is not exact-class at all.
    const problems = ruleRegistry
      .getRules()
      .filter((r) => r.meta.exactClassByDesign)
      .flatMap((r) => [
        ...(ENGINE_CITE_RE.test(r.meta.exactClassByDesign!)
          ? []
          : [`${r.meta.name}: exactClassByDesign cites no engine line`]),
        ...(r.meta.applicableNodeTypeMatcher
          ? [`${r.meta.name}: claims exact-class but declares a matcher`]
          : []),
      ]);
    expect(problems).toEqual([]);
  });

  it('reaches every subclass of a type a rule applies to', () => {
    // `RuleRegistry` matches `applicableNodeTypes` by exact name, so a rule
    // naming a type that HAS descendants goes silent on every one of them: the
    // subclass inherits the engine's configuration warning but not ours. A
    // matcher is the fix, but only if it matches the subclasses too, so both
    // forms are checked against the committed catalog's ancestry. A rule
    // targeting a childless leaf (the common case) stays free to use the
    // simpler exact list.
    const catalog = JSON.parse(
      readFileSync(resolve(linterDir, '../../../../scripts/compare-docs/node-catalog.json'), 'utf8')
    ) as { nodes: { name: string; chain: string[] }[] };

    const descendants = new Map<string, string[]>();
    for (const n of catalog.nodes) {
      for (const ancestor of n.chain) {
        if (ancestor === n.name) continue;
        let list = descendants.get(ancestor);
        if (!list) descendants.set(ancestor, (list = []));
        list.push(n.name);
      }
    }
    // Without this the guard is vacuous whenever the catalog's shape drifts.
    expect(descendants.get('Node3D')?.length).toBeGreaterThan(10);

    const unreachable = ruleRegistry.getRules().flatMap((rule) => {
      const { name, applicableNodeTypes, applicableNodeTypeMatcher } = rule.meta;
      if (rule.meta.exactClassByDesign) return [];
      if (applicableNodeTypeMatcher) {
        return catalog.nodes
          .filter((n) => applicableNodeTypeMatcher(n.name))
          .flatMap((n) =>
            (descendants.get(n.name) ?? []).filter((d) => !applicableNodeTypeMatcher(d))
          )
          .map((d) => `${name}: matcher misses ${d}`);
      }
      return (applicableNodeTypes ?? [])
        .filter((t) => (descendants.get(t) ?? []).length > 0)
        .map((t) => `${name}: ${t} misses ${descendants.get(t)!.join(', ')}`);
    });

    expect(unreachable.sort()).toEqual([]);
  });
});
