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

function walk(dir: string, match: string | ((name: string) => boolean)): string[] {
  const matches = typeof match === 'string' ? (name: string) => name === match : match;
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, matches));
    else if (matches(entry.name)) out.push(full);
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
/**
 * `makeAreaLinterRule('3D')` → `valid-area3d`, and the two-argument form
 * `makeCastLinterRule('3D', 'Ray')` → `valid-raycast3d`, where the second
 * argument selects a family the factory serves and prefixes the name.
 */
const FACTORY_RULE_RE = /make(\w+?)LinterRule\(\s*'(2D|3D)'\s*(?:,\s*'(\w+)'\s*)?\)/g;

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
    const family = (m[3] ?? '').toLowerCase();
    out.push(`valid-${family}${m[1]!.toLowerCase()}${m[2]!.toLowerCase()}${suffix}`);
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
 */
/**
 * Remove every `emits: [ … ]` array before scraping, else the guard validates
 * its own declarations. Bracket-matched rather than regex'd: an emits array may
 * be one line (`emits: [{ ruleName, severity: 'error' }]`) or many, and may
 * contain nested brackets (the conditional entry in collisionShapeLinterRule).
 */
function stripEmits(src: string): string {
  // Anchored to a property position (line start or after `{`/`,`) and required to
  // be followed by `[`. A bare indexOf also matched `emits:` inside a comment or
  // string and then cut everything up to the next `]`, silently deleting real
  // diagnostics from the scrape and disabling the guard for them.
  const opener = /(?:^|[{,])\s*emits:\s*\[/gm;
  let out = '';
  let index = 0;
  for (;;) {
    opener.lastIndex = index;
    const match = opener.exec(src);
    if (!match) return out + src.slice(index);
    const at = match.index + match[0].indexOf('emits:');
    const open = src.indexOf('[', at);
    let depth = 0;
    let close = open;
    for (; close < src.length; close++) {
      if (src[close] === '[') depth++;
      else if (src[close] === ']' && --depth === 0) break;
    }
    out += src.slice(index, at);
    index = close + 1;
  }
}

/** A `${…}` interpolation stands for any prefix: `${prefix}-inactive` -> `*-inactive`. */
const normalize = (name: string) => name.replace(/\$\{[^}]+\}/g, '*');

/**
 * Does a SCRAPED name cover a DECLARED one? Only the scraped side can hold a `*`
 * (normalize() runs on source text; `meta.emits` values are runtime strings), so
 * the match is one-directional: `*-extreme-energy` covers the declared literal
 * `omnilight3d-extreme-energy`.
 */
function pairMatches(scraped: string, declared: string): boolean {
  if (scraped === declared) return true;
  if (!scraped.includes('*')) return false;
  const pattern = scraped
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${pattern}$`).test(declared);
}

/**
 * Scrape `(ruleName, severity)` pairs from a file, ignoring its `emits` blocks.
 *
 * Every diagnostic object literal in this codebase writes `severity:` before
 * `ruleName:`, so a ruleName pairs with the most recent severity seen since the
 * previous ruleName. A ruleName with no preceding severity is a `rangeAdvisory`
 * arm, and those are `warning` by construction (rangeAdvisory.ts).
 */
const scrapeCache = new Map<string, Array<{ name: string; severity: string }>>();

function scrapePairs(file: string): Array<{ name: string; severity: string }> {
  const cached = scrapeCache.get(file);
  if (cached) return cached;
  const src = stripEmits(readFileSync(file, 'utf8'));

  // A rule may hoist its name (`const ruleName = \`valid-x${dim}-resources\``)
  // and then use the shorthand `ruleName,` in the diagnostic. Resolve those
  // bindings so the name is still visible to the scrape.
  const bindings = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']+)'|`([^`]+)`)/g)) {
    bindings.set(m[1]!, m[2] ?? m[3]!);
  }
  // `(?<!:\s*)` keeps the meta's own `name: ruleName,` out of the emission scrape
  // — that line names the REGISTRY key, not a reported diagnostic.
  const token =
    /severity:\s*'(error|warning)'|ruleName:\s*(?:'([^']+)'|`([^`]+)`|(\w+))|(?<![.\w])(?<!:\s*)ruleName\s*[,}]/g;
  const pairs: Array<{ name: string; severity: string }> = [];
  let severity: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = token.exec(src)) !== null) {
    if (m[1]) {
      severity = m[1];
      continue;
    }
    const literal = m[2] ?? m[3];
    let name: string | null = null;
    if (literal !== undefined) {
      name = normalize(literal);
    } else {
      // `ruleName: ident` or the `{ ruleName, … }` shorthand. Only a name we can
      // actually resolve counts — otherwise this matches `ruleName: string` in a
      // type declaration and `arm.ruleName` in a passthrough.
      const ident = m[4] ?? 'ruleName';
      const bound = bindings.get(ident);
      if (bound !== undefined) name = normalize(bound);
    }
    // Reset even when the name is unresolvable: leaving the pending severity in
    // place attributed it to the NEXT ruleName scraped in this file.
    const pending = severity;
    severity = null;
    if (name === null) continue;
    pairs.push({ name, severity: pending ?? 'warning' });
  }
  scrapeCache.set(file, pairs);
  return pairs;
}

describe('rule emits meta-guard', () => {
  const byRuleName = new Map(ruleRegistry.getRules().map((r) => [r.meta.name, r]));

  it('every registered rule declares a non-empty emits', () => {
    const undeclared = ruleRegistry
      .getRules()
      .filter((r) => !r.meta.emits || r.meta.emits.length === 0)
      .map((r) => r.meta.name)
      .sort();
    expect(undeclared).toEqual([]);
  });

  it('every literal ruleName in a slice is declared by that slice rule', () => {
    const missing: string[] = [];
    for (const file of walk(nodesRoot, 'linter.ts')) {
      const owners = [...extractAll(file, RULE_NAME_RE), ...extractFactoryRuleNames(file)];
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
   * `omnilight3d-extreme-energy` while the name is built in a shared arm builder
   * as `${rulePrefix}-extreme-energy`, and the physics factories live outside
   * `src/nodes` entirely. Comparing the whole tree at once — with `${…}` treated
   * as a wildcard — covers both without a skip list, and checks severity, which
   * nothing else did.
   */
  const sourceRoots = [nodesRoot, here];
  // `strict-parser` is not a rule emission: Linter.ts stamps it on Phase-1 parse
  // errors, which come from the validator side and belong to no LintRule.
  const NON_RULE_NAMES = new Set(['strict-parser']);
  const isSourceTs = (name: string) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name);
  const allFiles = sourceRoots.flatMap((r) => walk(r, isSourceTs));
  const codePairs = allFiles
    .flatMap((f) => scrapePairs(f))
    .filter((p) => !NON_RULE_NAMES.has(p.name));

  /**
   * Local (relative) imports of a file, resolved to real `.ts` paths. Memoized:
   * the closure walk below revisits the same files across all 41 rules, and
   * re-reading each one dominated this test's runtime.
   */
  const importCache = new Map<string, string[]>();
  function localImports(file: string): string[] {
    const memo = importCache.get(file);
    if (memo) return memo;
    const src = readFileSync(file, 'utf8');
    const dir = dirname(file);
    const out: string[] = [];
    for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
      const base = resolve(dir, m[1]!.replace(/\.js$/, ''));
      for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
        if (existsSync(candidate)) {
          out.push(candidate);
          break;
        }
      }
    }
    importCache.set(file, out);
    return out;
  }

  /**
   * Every file a rule's `check` can reach, transitively. A slice names some
   * diagnostics through a shared arm builder or a physics factory, and those
   * files must count as its own — but ONLY its own. Matching a template against
   * the whole tree instead let any rule declare any name a template could
   * produce: `camera2d-inactive` was accepted on Camera2D purely because the
   * unrelated Area factory emits `${prefix}-inactive`.
   */
  const reachableCache = new Map<string, Array<{ name: string; severity: string }>>();
  function reachablePairs(file: string) {
    const cached = reachableCache.get(file);
    if (cached) return cached;
    const seen = new Set<string>();
    const queue = [file];
    const pairs: Array<{ name: string; severity: string }> = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      pairs.push(...scrapePairs(current));
      queue.push(...localImports(current));
    }
    reachableCache.set(file, pairs);
    return pairs;
  }

  /** meta.name -> the slice file declaring it. */
  const fileByRuleName = new Map<string, string>();
  for (const file of walk(nodesRoot, 'linter.ts')) {
    for (const name of [...extractAll(file, RULE_NAME_RE), ...extractFactoryRuleNames(file)]) {
      fileByRuleName.set(name, file);
    }
  }

  it('declares no ruleName its own code cannot emit', () => {
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
    const declared = ruleRegistry.getRules().flatMap((r) => r.meta.emits ?? []);
    const undeclared = codePairs
      .filter((p) => !declared.some((e) => pairMatches(p.name, e.ruleName) && e.severity === p.severity))
      .map((p) => `${p.name} (${p.severity})`);
    expect([...new Set(undeclared)].sort()).toEqual([]);
  });

  /**
   * Every arm builder in the tree, as the concrete rule names one CALL produces.
   *
   * A slice like AreaLight3D holds no literal ruleName at all: it returns
   * `rangeAdvisories(node, { light_energy: lightEnergyArms('arealight3d') })` and
   * every name is interpolated inside the builder. The checks above are all
   * satisfied by that shape — nothing to scrape locally, declared is a subset of
   * reachable, and the global check matches the builder's `*-extreme-energy`
   * template against some OTHER light's already-declared name. So adding a second
   * arm builder to such a slice used to change what it reports with every test
   * still green. Resolving the call site pins the names to the calling rule.
   */
  const armSuffixes = new Map<string, string[]>();
  for (const file of allFiles) {
    const src = readFileSync(file, 'utf8');
    for (const fn of src.matchAll(/export function (\w+Arms)\(\s*(\w+)/g)) {
      const [, builder, param] = fn;
      const start = fn.index!;
      const end = src.indexOf('\n}', start);
      const body = src.slice(start, end === -1 ? undefined : end);
      const suffixes = [...body.matchAll(/ruleName:\s*`\$\{(\w+)\}([^`]*)`/g)]
        .filter((m) => m[1] === param)
        .map((m) => m[2]!);
      if (suffixes.length) armSuffixes.set(builder!, [...new Set(suffixes)]);
    }
  }

  it('declares the names each arm-builder call actually produces', () => {
    const missing: string[] = [];
    for (const file of walk(nodesRoot, 'linter.ts')) {
      const owners = [...extractAll(file, RULE_NAME_RE), ...extractFactoryRuleNames(file)]
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
    //
    // Counts BOTH spellings. A factory-built slice contains no `name: '…'`
    // literal at all, so scraping RULE_NAME_RE alone evaluated `[].length > 1`
    // and passed without inspecting anything — vacuous for every slice built
    // from makeAreaLinterRule / makeCastLinterRule / makeCollisionShapeLinterRule
    // / makeNavigationRegionLinterRule, which is ten of them.
    const multiple = walk(nodesRoot, 'linter.ts')
      .map((f) => ({ f, names: [...extractAll(f, RULE_NAME_RE), ...extractFactoryRuleNames(f)] }))
      .filter((e) => e.names.length > 1)
      .map((e) => `${e.f.slice(nodesRoot.length + 1)}: ${e.names.join(', ')}`);
    expect(multiple).toEqual([]);
  });

  it('sees a rule in every slice linter.ts, whichever spelling it uses', () => {
    // The guard above can only bite on files it can read a rule out of. If a
    // future factory is named differently, FACTORY_RULE_RE stops matching and
    // that slice silently leaves the inventory — so assert the scrape finds
    // something everywhere, which is what makes the count meaningful.
    const invisible = walk(nodesRoot, 'linter.ts')
      .filter((f) => extractAll(f, RULE_NAME_RE).length + extractFactoryRuleNames(f).length === 0)
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
