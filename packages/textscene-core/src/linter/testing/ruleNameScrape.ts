/**
 * Filesystem scrape of the rule names a slice DECLARES, shared by the
 * `ruleCoverage.*.test.ts` guards.
 *
 * `meta.name` is the registry key, and a slice spells it in one of two ways: an
 * inline `name: '…'` literal, or a call to a shared dim-parameterized factory.
 * Every guard that compares the filesystem against a live registry needs both
 * spellings and the same directory walk, so they live here once — a second copy
 * would go stale in exactly the direction that makes a guard vacuous.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `.../src/linter` — this module sits one level below it, in `testing/`. */
export const linterDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const nodesRoot = resolve(linterDir, '../nodes');

export function walk(dir: string, match: string | ((name: string) => boolean)): string[] {
  const matches = typeof match === 'string' ? (name: string) => name === match : match;
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, matches));
    else if (matches(entry.name)) out.push(full);
  }
  return out;
}

/**
 * A scraped population, refusing to be smaller than it can legitimately get.
 *
 * The floor belongs to the SCRAPE, not to each guard that consumes it. Every
 * one of these guards reports "nothing wrong" as an empty list, so a walk that
 * silently matched nothing is indistinguishable from a clean tree — that is
 * exactly how `codePairs` and `armBuilderSuffixes` shipped with no floor at
 * all. Putting it here means the next consumer inherits it instead of
 * remembering it.
 *
 * These are deliberately far below the real counts: they catch a scrape that
 * BROKE, not a tree that changed. A guard that also wants to notice drift pins
 * the exact number at its own call site, which is a different assertion.
 */
function atLeast<T>(items: T[], floor: number, what: string): T[] {
  if (items.length < floor) {
    throw new Error(`${what}: scraped ${items.length}, expected at least ${floor} — the walk is broken`);
  }
  return items;
}

/** Every `linter.ts` under `src/nodes/` — one per slice that declares a rule. */
export const ruleFiles = (): string[] => atLeast(walk(nodesRoot, 'linter.ts'), 100, 'ruleFiles');

/** A source module, as opposed to a test: the population a scrape reads. */
const isSourceTs = (name: string) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name);

/** Every source module a diagnostic could be named in: the slices and the linter itself. */
export const allSourceFiles = (): string[] =>
  atLeast(
    [nodesRoot, linterDir].flatMap((root) => walk(root, isSourceTs)),
    1000,
    'allSourceFiles'
  );

const RULE_NAME_RE = /^\s*name:\s*'([^']+)'/gm;

/**
 * The types a `linterParser.ts` speaks for — BOTH spellings.
 *
 * A slice whose whole contribution is subtractive (`HBoxContainer` fixing the
 * orientation `BoxContainer` exposes) calls only `registerUnavailable`, so
 * matching `registerAll` alone dropped six slices out of every sweep built on
 * this constant. Note that a removal is registered apart from the validators,
 * so such a type is absent from `getRegisteredNodeTypes()` and a consumer
 * comparing against the live registry must union `getTypesWithRemovals()` in.
 */
export const REGISTER_ALL_RE = /register(?:All|Unavailable)\(\s*'([^']+)'/g;

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

/**
 * Every first capture group of `re` in `file`.
 *
 * `matchAll` rather than a hand-driven `exec` loop: it builds its own regex
 * through the species constructor, so a shared global `RegExp` never carries
 * its `lastIndex` from one caller into the next.
 */
export function extractAll(file: string, re: RegExp): string[] {
  return [...readFileSync(file, 'utf8').matchAll(re)].map((m) => m[1]!);
}

function factoryRuleNames(src: string): string[] {
  return [...src.matchAll(FACTORY_RULE_RE)].map((m) => {
    const suffix = m[1] === 'NavigationRegion' ? '-resources' : '';
    const family = (m[3] ?? '').toLowerCase();
    return `valid-${family}${m[1]!.toLowerCase()}${m[2]!.toLowerCase()}${suffix}`;
  });
}

/**
 * Every rule name a file declares, in BOTH spellings.
 *
 * Always the pair: a factory-built slice contains no `name: '…'` literal at all,
 * so a guard reading `RULE_NAME_RE` alone inspects nothing and passes — which is
 * ten slices' worth of silence (makeAreaLinterRule / makeCastLinterRule /
 * makeCollisionShapeLinterRule / makeNavigationRegionLinterRule).
 */
export function declaredRuleNames(file: string): string[] {
  // One read for both spellings. Every guard here calls this once per slice
  // across the whole tree, several times over, so a second read is ~121 files
  // of pure repetition per pass.
  const src = readFileSync(file, 'utf8');
  return [...[...src.matchAll(RULE_NAME_RE)].map((m) => m[1]!), ...factoryRuleNames(src)];
}
