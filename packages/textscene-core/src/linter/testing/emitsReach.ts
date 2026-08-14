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
export interface ArmBuilder {
  /** Position of the templated parameter in the builder's signature. */
  index: number;
  /** Its name, so a template can be substituted rather than concatenated. */
  param: string;
  /** Every `ruleName` template in the body that interpolates it, whole. */
  templates: string[];
}

export interface ArmBuilders {
  /** Builder name -> how to turn one call's argument into the names it emits. */
  builders: Map<string, ArmBuilder>;
  /** Builders interpolating a parameter this scrape could not pin to a position. */
  unresolvable: string[];
}

/**
 * The text from `open` (an index pointing at a bracket) to its match.
 *
 * Depth-tracked rather than `[^)]*`, because a parameter list routinely
 * contains its own brackets — an object type, a function-typed parameter, a
 * default value — and the lazy form stops at the first one.
 */
const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const CLOSERS = new Set(Object.values(OPENERS));
const QUOTES = new Set(["'", '"', '`']);

/**
 * Walk `text` from `from`, calling `at` with each index at nesting depth 0.
 *
 * Two exclusions, both found by this module's own tests rather than reasoned
 * about: a comma inside a STRING literal is not a separator (`f(node, 'a, b')`
 * split into three arguments and the middle two then matched no quoted-literal
 * pattern), and the `>` of an arrow type is not a closing bracket (`cb: (a) =>
 * void, after` drove the depth negative and swallowed every later comma). `<`
 * is still tracked, because a generic parameter type is far more common in
 * these signatures than a comparison.
 */
function scanTopLevel(text: string, from: number, at: (index: number, depth: number) => boolean): void {
  let depth = 0;
  let quote = '';
  for (let i = from; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
      continue;
    }
    if (QUOTES.has(ch)) {
      quote = ch;
      continue;
    }
    if (OPENERS[ch]) depth += 1;
    else if (CLOSERS.has(ch) && !(ch === '>' && text[i - 1] === '=')) depth -= 1;
    if (at(i, depth)) return;
  }
}

/** The text from `open` (an index pointing at a bracket) to its match. */
export function balancedGroup(src: string, open: number): string {
  let end = -1;
  scanTopLevel(src, open, (i, depth) => {
    if (depth !== 0) return false;
    end = i;
    return true;
  });
  return end === -1 ? '' : src.slice(open + 1, end);
}

/** Split on TOP-LEVEL commas only, so a nested type never ends an entry. */
export function topLevelParts(body: string): string[] {
  const out: string[] = [];
  let start = 0;
  scanTopLevel(body, 0, (i, depth) => {
    if (depth === 0 && body[i] === ',') {
      out.push(body.slice(start, i));
      start = i + 1;
    }
    return false;
  });
  if (body.slice(start).trim() !== '') out.push(body.slice(start));
  return out;
}

/**
 * The parameter names of a signature, IN ORDER.
 *
 * Ordered, because the guard above resolves a call site by argument POSITION.
 * The set-returning predecessor was matched with an alternation that consumed
 * the separating comma, so `(node, rulePrefix)` yielded only `node` — and the
 * one real builder templates its SECOND parameter, which is why the loop that
 * consumed this was structurally always empty.
 */
export function parameterList(signature: string): string[] {
  return topLevelParts(signature)
    .map((part) => /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)/.exec(part)?.[1])
    .filter((name): name is string => name !== undefined);
}

export function armBuilderSuffixes(files: string[]): ArmBuilders {
  const builders = new Map<string, ArmBuilder>();
  const unresolvable: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const fn of src.matchAll(/export function (\w+)\s*\(/g)) {
      const builder = fn[1]!;
      const start = fn.index!;
      const signature = balancedGroup(src, start + fn[0].length - 1);
      const end = src.indexOf('\n}', start);
      const body = src.slice(start, end === -1 ? undefined : end);
      // A bare identifier or quoted string reaches the literal scrape; only a
      // template is this function's business. The WHOLE template is kept, so a
      // prefix in the middle (`valid-${p}-resources`) substitutes correctly
      // rather than being concatenated onto the end.
      const templates = [...body.matchAll(/ruleName:\s*`([^`]*)`/g)].map((m) => m[1]!);
      const params = parameterList(signature);
      const interpolated = params
        .map((param, index) => ({ param, index }))
        .filter(({ param }) => templates.some((t) => t.includes(`\${${param}}`)));
      if (!interpolated.length) continue;
      // Two parameters interpolated by different templates is a shape this
      // scrape cannot pin to one position, and a name nothing pins to a rule.
      if (interpolated.length > 1) {
        unresolvable.push(builder);
        continue;
      }
      const { param, index } = interpolated[0]!;
      builders.set(builder, {
        index,
        param,
        templates: templates.filter((t) => t.includes(`\${${param}}`)),
      });
    }
  }
  return { builders, unresolvable };
}
