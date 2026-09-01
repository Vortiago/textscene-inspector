/**
 * Lint-rule and validator coverage meta-guard.
 *
 * Cross-checks the filesystem against the live registries so a rule or
 * validator can never ship unregistered:
 *
 *   1. The union of rule names declared in every `linter.ts` under
 *      `src/nodes/` equals the names in `ruleRegistry` — catching dead rule
 *      files (declared but never imported by an index.linter.ts) and rules
 *      registered outside slices.
 *   2. Every `registerAll('Type', ...)` / `registerUnavailable('Type', ...)`
 *      in a `linterParser.ts` is live in `validatorRegistry` after importing
 *      the linter barrel — catching a linterParser.ts whose registration
 *      never runs.
 *   3. Every slice `linter.ts` has a sibling `linter.test.ts`, and every
 *      registering `linterParser.ts` sits in a directory holding at least one
 *      test file.
 *
 * 3 asks EXISTENCE, and deliberately nothing else. Reading those test files
 * for a token was the gameable half — a name in a comment paid for it — but a
 * file being absent is not gameable, and it is the state `pnpm new:node`
 * leaves behind: a scaffolded slice registers, wires up, and every other gate
 * here reads it as covered. Suite quality is judged at /code-review. The floors
 * that stop any of these sweeps passing over an empty walk are inline:
 * `ruleFiles()` throws below 100 inside the scrape, and each sweep pins its own
 * count again.
 *
 * The `meta.emits` drift guard, which reads the same declarations, is the
 * sibling `ruleCoverage.emits.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ruleRegistry } from './RuleRegistry.js';
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
import { registeredTypes } from './registryPopulation.js';

describe('lint rule coverage meta-guard', () => {
  const files = ruleFiles();

  it('every slice linter.ts has a sibling linter.test.ts', () => {
    // The floor is what stops a broken walk reporting "nothing untested" about
    // a population of zero. 121 slices declare a rule.
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
    // 248 linterParser.ts files register today; a walk that found none would
    // otherwise report an empty `dead` list and pass.
    expect(registering.length).toBeGreaterThan(200);
    // Removals are registered separately from validators: a fixed-orientation
    // container adds none of its own, so it is absent from
    // `registeredTypes('declaring')` while being very much alive.
    const live = new Set(registeredTypes('answering'));
    const dead = registering
      .flatMap((e) => e.types.map((t) => ({ t, file: e.file })))
      .filter(({ t }) => !live.has(t))
      .map(({ t, file }) => `${t} (${file.slice(nodesRoot.length + 1)})`);
    // A type here means the linterParser.ts exists but its registration
    // never runs — missing index.linter.ts wiring.
    expect(dead).toEqual([]);
  });

  it('every registering linterParser.ts sits beside at least one test', () => {
    expect(registering.length).toBeGreaterThan(200);
    // Any test file, not a `linterParser.test.ts` by name: 19 slices exercise
    // their registration from `linter.test.ts` or a shared slice test instead,
    // and a name rule would have to carry all 19 as exemptions to say less.
    const untested = registering
      .map((e) => dirname(e.file))
      .filter((dir) => !readdirSync(dir).some((t) => /\.test\.tsx?$/.test(t)))
      .map((dir) => dir.slice(nodesRoot.length + 1));
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
