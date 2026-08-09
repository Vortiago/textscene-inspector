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

/** Every `linter.ts` under `src/nodes/` — one per slice that declares a rule. */
export const ruleFiles = (): string[] => walk(nodesRoot, 'linter.ts');

/** A source module, as opposed to a test: the population a scrape reads. */
const isSourceTs = (name: string) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name);

/** Every source module a diagnostic could be named in: the slices and the linter itself. */
export const allSourceFiles = (): string[] =>
  [nodesRoot, linterDir].flatMap((root) => walk(root, isSourceTs));

export const RULE_NAME_RE = /^\s*name:\s*'([^']+)'/gm;
export const REGISTER_ALL_RE = /registerAll\(\s*'([^']+)'/g;

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

export function extractAll(file: string, re: RegExp): string[] {
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

/**
 * Every rule name a file declares, in BOTH spellings.
 *
 * Always the pair: a factory-built slice contains no `name: '…'` literal at all,
 * so a guard reading `RULE_NAME_RE` alone inspects nothing and passes — which is
 * ten slices' worth of silence (makeAreaLinterRule / makeCastLinterRule /
 * makeCollisionShapeLinterRule / makeNavigationRegionLinterRule).
 */
export function declaredRuleNames(file: string): string[] {
  return [...extractAll(file, RULE_NAME_RE), ...extractFactoryRuleNames(file)];
}
