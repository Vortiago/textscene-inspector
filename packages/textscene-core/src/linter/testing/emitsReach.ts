/**
 * From one file's names to a RULE's names.
 *
 * A slice rarely spells every diagnostic it reports: the name is interpolated
 * inside a shared arm builder or a physics factory, in a file the slice merely
 * imports. Both functions here widen `scrapePairs` to cover that — the transitive
 * import closure, and the concrete suffixes one arm-builder call produces — and
 * both stop at the closure rather than the whole tree, because matching a
 * template against every file let any rule claim any name a template could make.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { scrapePairs, type EmittedPair } from './emitsScrape.js';

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
const reachableCache = new Map<string, EmittedPair[]>();

export function reachablePairs(file: string): EmittedPair[] {
  const cached = reachableCache.get(file);
  if (cached) return cached;
  const seen = new Set<string>();
  const queue = [file];
  const pairs: EmittedPair[] = [];
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

/**
 * Every rule-name builder in the tree, as the concrete suffixes one CALL
 * produces — plus the ones whose names this scrape could not resolve.
 *
 * A slice using one holds no literal name at all: the builder returns
 * `rangeAdvisories(node, { <prop>: someArms('<ruleprefix>') })` and every name
 * is interpolated inside the builder, so resolving the CALL site is what pins
 * those names to the calling rule. A builder whose names are literal is already
 * reached by the literal scrape and appears in neither list here.
 *
 * Keyed on the BODY — an exported function interpolating one of its own
 * PARAMETERS into `ruleName` — and not on an `…Arms` identifier, which is the
 * mistake this replaced. Nothing enforces that naming, so a future
 * `pitchAdvisories(prefix)` carrying the same template was invisible to this
 * scrape AND to the literal one, and the guard meant to notice it reported an
 * empty list and passed.
 *
 * A function interpolating a LOCAL it derived itself is a different mechanism
 * and deliberately absent: the dim-parameterized physics factories build
 * `prefix` from a `'2D'`/`'3D'` argument, so no call site states the name and
 * there is no exact suffix to pin. Those are covered by `reachablePairs` plus
 * `pairMatches`, which wildcard-matches `${…}` against the rule's declaration.
 * The parameter case is the one where an exact name IS knowable, which is why
 * failing to resolve one is a defect rather than a category.
 */
export interface ArmBuilders {
  /** Builder name -> the rule-name suffixes one call appends to its prefix. */
  suffixes: Map<string, string[]>;
  /** Builders interpolating a parameter this scrape could not resolve a suffix from. */
  unresolvable: string[];
}

/** The identifiers in a function's parameter list, as source text. */
function parameterNames(signature: string): Set<string> {
  return new Set([...signature.matchAll(/(?:^|[(,])\s*(\w+)\s*[,:)]/g)].map((m) => m[1]!));
}

export function armBuilderSuffixes(files: string[]): ArmBuilders {
  const suffixes = new Map<string, string[]>();
  const unresolvable: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const fn of src.matchAll(/export function (\w+)\(([^)]*)\)/g)) {
      const [, builder, signature] = fn;
      const start = fn.index!;
      const end = src.indexOf('\n}', start);
      const body = src.slice(start, end === -1 ? undefined : end);
      // A bare identifier or quoted string reaches the literal scrape; only a
      // template is this function's business.
      const templated = [...body.matchAll(/ruleName:\s*`\$\{(\w+)\}([^`]*)`/g)];
      if (!templated.length) continue;
      const params = parameterNames(signature!);
      const fromParam = templated.filter((m) => params.has(m[1]!));
      if (!fromParam.length) continue;
      const found = fromParam.map((m) => m[2]!).filter((s) => s !== '');
      if (found.length) suffixes.set(builder!, [...new Set(found)]);
      else unresolvable.push(builder!);
    }
  }
  return { suffixes, unresolvable };
}
