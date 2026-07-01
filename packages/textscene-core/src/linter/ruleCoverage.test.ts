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
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleRegistry } from './RuleRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
const nodesRoot = resolve(here, '../nodes');

function walk(dir: string, fileName: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, fileName));
    else if (entry.name === fileName) out.push(full);
  }
  return out;
}

const RULE_NAME_RE = /^\s*name:\s*'([^']+)'/gm;
const REGISTER_ALL_RE = /registerAll\(\s*'([^']+)'/g;

// A slice may also declare its rule via a shared dim-parameterized factory
// (e.g. `makeAreaLinterRule('2D')`) instead of an inline `name: '...'` literal.
// The factory names the rule `valid-<family><dim>` (family = the factory's
// middle segment, lowercased), so credit that as a declaration here.
// NavigationRegion is the one irregular family: its rule carries a `-resources`
// suffix (`valid-navigationregion2d-resources`).
const FACTORY_RULE_RE = /make(\w+?)LinterRule\(\s*'(2D|3D)'\s*\)/g;

function extractAll(file: string, re: RegExp): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  const matcher = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = matcher.exec(src)) !== null) out.push(m[1]!);
  return out;
}

function extractFactoryRuleNames(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  const matcher = new RegExp(FACTORY_RULE_RE.source, FACTORY_RULE_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = matcher.exec(src)) !== null) {
    const suffix = m[1] === 'NavigationRegion' ? '-resources' : '';
    out.push(`valid-${m[1]!.toLowerCase()}${m[2]!.toLowerCase()}${suffix}`);
  }
  return out;
}

describe('lint rule coverage meta-guard', () => {
  const ruleFiles = walk(nodesRoot, 'linter.ts');

  it('every slice linter.ts has a sibling linter.test.ts', () => {
    const untested = ruleFiles
      .filter((f) => !existsSync(join(dirname(f), 'linter.test.ts')))
      .map((f) => f.slice(nodesRoot.length + 1));
    expect(untested).toEqual([]);
  });

  it('declared rule names match the live ruleRegistry exactly', () => {
    const declared = new Set(
      ruleFiles.flatMap((f) => [...extractAll(f, RULE_NAME_RE), ...extractFactoryRuleNames(f)])
    );
    const registered = new Set(ruleRegistry.getRules().map((r) => r.meta.name));

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

  it('every registerAll node type is live in validatorRegistry', () => {
    const live = new Set(validatorRegistry.getRegisteredNodeTypes());
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
});
