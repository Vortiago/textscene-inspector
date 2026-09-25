/**
 * Cross-checks the filesystem against the live registries, so no rule or
 * validator ships unregistered or without a test file. The test check asks only
 * existence: a token read from a test is gameable, and `pnpm new:node` leaves a
 * slice with none. `ruleCoverage.emits.test.ts` guards `meta.emits`.
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
    // The floor stops a broken walk reporting "nothing untested" about a
    // population of zero. `ruleFiles()` also throws below it.
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

    // A name here means a slice's linter.ts is never imported (missing
    // index.linter.ts wiring), so the rule does not run.
    expect(declaredButNotRegistered).toEqual([]);
    // A name here means a rule registered from outside src/nodes: rules belong
    // to slices.
    expect(registeredOutsideSlices).toEqual([]);
  });
});

describe('validator coverage meta-guard', () => {
  const parserFiles = walk(nodesRoot, 'linterParser.ts');
  const registering = parserFiles
    .map((f) => ({ file: f, types: extractAll(f, REGISTER_ALL_RE) }))
    .filter((e) => e.types.length > 0);

  it('counts the slices whose whole contribution is a removal', () => {
    // They call `registerUnavailable` and no `registerAll`, so a scrape of
    // `registerAll` alone hides a removal that stopped running.
    expect(registering.flatMap((e) => e.types)).toEqual(
      expect.arrayContaining(['HBoxContainer', 'VSplitContainer', 'VFlowContainer'])
    );
  });

  it('every registered node type is live in validatorRegistry', () => {
    // A walk that found no registering file would report an empty `dead`
    // list and pass.
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
    // never runs: missing index.linter.ts wiring.
    expect(dead).toEqual([]);
  });

  it('every registering linterParser.ts sits beside at least one test', () => {
    expect(registering.length).toBeGreaterThan(200);
    // Any test file, not a `linterParser.test.ts` by name: some slices exercise
    // their registration from `linter.test.ts` or a shared slice test.
    const untested = registering
      .map((e) => dirname(e.file))
      .filter((dir) => !readdirSync(dir).some((t) => /\.test\.tsx?$/.test(t)))
      .map((dir) => dir.slice(nodesRoot.length + 1));
    expect(untested).toEqual([]);
  });

  it('every exact-class exemption cites an engine guard and needs no matcher', () => {
    // The claim lives on the rule (`RuleMeta.exactClassByDesign`), so it cannot
    // outlive its rule. It needs an engine citation and no matcher, since a rule
    // with a matcher is not exact-class.
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
    // `RuleRegistry` matches `applicableNodeTypes` by exact name, so a rule on a
    // type with descendants is silent on each subclass that inherits the engine's
    // warning. Both forms are checked against the catalog's ancestry, and a
    // childless leaf may keep the exact list.
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

  it('no rule re-checks its own applicability with an early return', () => {
    // `applicableNodeTypes` / `applicableNodeTypeMatcher` already decide which
    // nodes reach `check`; a `node.type !== 'X'` guard inside it restates that
    // decision where the registry cannot see it.
    const guard = /if \(\s*node\.type\s*!==\s*'[A-Za-z0-9]+'\s*\)\s*return \[\];/;
    const restating = ruleFiles()
      .filter((f) => guard.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(nodesRoot.length + 1));
    expect(restating).toEqual([]);
  });
});
