/**
 * Filesystem scrape of the rule names a slice declares, shared by the
 * `ruleCoverage.*.test.ts` guards: an inline `name: '…'` literal, or a call to a
 * shared dim-parameterised factory. One copy, since a stale second copy makes a
 * guard vacuous.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `.../src/linter`: this module sits one level below it, in `testing/`. */
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
 * A scraped population, refusing to be smaller than it can legitimately get. An
 * empty list reads as a clean tree, so the floor belongs to the scrape and every
 * consumer inherits it. Floors sit far below the real counts, to catch a broken
 * scrape: a guard that wants drift pins the exact number at its own call site.
 */
export function atLeast<T>(items: T[], floor: number, what: string): T[] {
  if (items.length < floor) {
    throw new Error(`${what}: scraped ${items.length}, expected at least ${floor} — the walk is broken`);
  }
  return items;
}

/** Every `linter.ts` under `src/nodes/`, one per slice that declares a rule. */
export const ruleFiles = (): string[] => atLeast(walk(nodesRoot, 'linter.ts'), 100, 'ruleFiles');

/** `.../src`: the whole package, not one subtree of it. */
export const srcRoot = resolve(linterDir, '..');

/** A source module, as opposed to a test: the population a scrape reads. */
const isSourceModule = (name: string) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);

/**
 * Every source module in the package, `.tsx` included. The whole of `src/`: a
 * guard on this asks "does this exist anywhere", and a walk that names its roots
 * answers "anywhere I remembered". Memoised, since several guards call it.
 */
let sourceFileCache: string[] | undefined;
export const allSourceFiles = (): string[] =>
  (sourceFileCache ??= atLeast(walk(srcRoot, isSourceModule), 1000, 'allSourceFiles'));

const RULE_NAME_RE = /^\s*name:\s*'([^']+)'/gm;

/**
 * The types a `linterParser.ts` speaks for, in both spellings: a subtractive
 * slice such as `HBoxContainer` calls only `registerUnavailable`. Such a type is
 * absent from `registeredTypes('declaring')`, so compare the live registry
 * against `registeredTypes('answering')`, the union.
 */
export const REGISTER_ALL_RE = /register(?:All|Unavailable)\(\s*'([^']+)'/g;

/**
 * A shared dim-parameterised factory names its rule `valid-<family><dim>`:
 * `makeAreaLinterRule('3D')` gives `valid-area3d`, and `makeCastLinterRule('3D',
 * 'Ray')` gives `valid-raycast3d`, the second argument a prefix. NavigationRegion
 * alone adds `-resources` (`valid-navigationregion2d-resources`).
 */
const FACTORY_RULE_RE = /make(\w+?)LinterRule\(\s*'(2D|3D)'\s*(?:,\s*'(\w+)'\s*)?\)/g;

/**
 * Every first capture group of `re` in `file`. `matchAll`, not an `exec` loop:
 * it clones the regex, so a shared global `RegExp` never carries `lastIndex`
 * from one caller into the next.
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
 * Every rule name a file declares, in both spellings: a factory-built slice has
 * no `name: '…'` literal, so `RULE_NAME_RE` alone inspects nothing and passes.
 */
export function declaredRuleNames(file: string): string[] {
  // One read for both spellings: every guard calls this once per slice.
  const src = readFileSync(file, 'utf8');
  return [...[...src.matchAll(RULE_NAME_RE)].map((m) => m[1]!), ...factoryRuleNames(src)];
}
