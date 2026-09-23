/**
 * Widens `scrapePairs` from one file's names to a rule's names: the transitive
 * import closure, and the suffixes one arm-builder call produces. Both stop at
 * the closure, since a template matched against every file lets any rule claim
 * any name the template can make.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { scrapePairs, type EmittedPair } from './emitsScrape.js';

/**
 * Local (relative) imports of a file, resolved to real `.ts` paths. Memoised:
 * the closure walk revisits the same files for every rule.
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
 * Every file a rule's `check` can reach, transitively, since a slice names some
 * diagnostics through a shared arm builder or a physics factory. Only its own:
 * the whole tree would accept `camera2d-inactive` on Camera2D from the Area
 * factory's `${prefix}-inactive`.
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

/** A builder whose rule names one call's argument pins exactly. */
export interface ArmBuilder {
  /** Position of the templated parameter in the builder's signature. */
  index: number;
  /** Its name, so a template can be substituted rather than concatenated. */
  param: string;
  /** Every `ruleName` template in the body that interpolates it, whole. */
  templates: string[];
}

/**
 * A builder that templates a rule name this scrape cannot pin to a call site:
 * a physics factory interpolates a local derived from its parameter, and a
 * navigation one hoists the whole name. The caller checks its templates against
 * the declared names, interpolations wildcarded.
 */
export interface UnpinnedBuilder {
  builder: string;
  /** Every `ruleName` template in its body, whole. */
  templates: string[];
}

export interface ArmBuilders {
  /** Builder name -> how to turn one call's argument into the names it emits. */
  builders: Map<string, ArmBuilder>;
  /** Builders whose templated names this scrape could not pin to a position. */
  unresolvable: UnpinnedBuilder[];
}

const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const CLOSERS = new Set(Object.values(OPENERS));
const QUOTES = new Set(["'", '"', '`']);

/**
 * Walk `text` from `from`, calling `at` with each index at nesting depth 0. A
 * comma inside a string literal is no separator, and the `>` of an arrow type
 * closes nothing. `<` is tracked, because a generic parameter type is far more
 * common in these signatures than a comparison.
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

/**
 * The text from `open` (an index pointing at a bracket) to its match. It tracks
 * depth, since `[^)]*` stops at the first bracket inside a parameter list.
 */
export function balancedGroup(src: string, open: number): string {
  let end = -1;
  scanTopLevel(src, open, (i, depth) => {
    if (depth !== 0) return false;
    end = i;
    return true;
  });
  return end === -1 ? '' : src.slice(open + 1, end);
}

/** Split on top-level commas only, so a nested type never ends an entry. */
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

/** The parameter names of a signature, in order: a call site resolves by argument position. */
export function parameterList(signature: string): Array<string | null> {
  // `null` holds the slot for a destructured parameter, so every later index,
  // which the call-site lookup keys on, stays put.
  return topLevelParts(signature).map(
    (part) => /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)/.exec(part)?.[1] ?? null
  );
}

/**
 * Every exported function that interpolates one of its own parameters into a
 * `ruleName` template, found by its body, since nothing enforces an `…Arms` name.
 * A builder with literal names is the literal scrape's, and appears in neither list.
 */
export function armBuilders(files: string[]): ArmBuilders {
  const builders = new Map<string, ArmBuilder>();
  const unresolvable: UnpinnedBuilder[] = [];
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const fn of src.matchAll(/export function (\w+)\s*\(/g)) {
      const builder = fn[1]!;
      const start = fn.index!;
      const end = src.indexOf('\n}', start);
      const body = src.slice(start, end === -1 ? undefined : end);
      // Only a template is this function's business, kept whole so a prefix in
      // the middle (`valid-${p}-resources`) substitutes. Both spellings: the
      // navigation factories hoist the name first (`const ruleName = `…``).
      const templates = [
        ...body.matchAll(/ruleName:\s*`([^`]*)`/g),
        ...body.matchAll(/\bconst\s+\w*[rR]uleName\w*\s*=\s*`([^`]*)`/g),
      ].map((m) => m[1]!);
      // Before the signature is touched: few exported functions template a rule
      // name, and scraping every other one's parameters is the bulk of the walk.
      if (!templates.length) continue;
      const params = parameterList(balancedGroup(src, start + fn[0].length - 1));
      const interpolated = params
        .map((param, index) => ({ param, index }))
        .filter(
          (entry): entry is { param: string; index: number } =>
            entry.param !== null && templates.some((t) => t.includes(`\${${entry.param}}`))
        );
      // Reported, not skipped. A physics factory interpolates a local
      // (`const prefix = \`area${dimSuffix(dim)}\``), which `reachablePairs` and
      // `pairMatches` wildcard. Two interpolated parameters are a defect, since a
      // parameter makes the exact name knowable.
      if (interpolated.length !== 1) {
        unresolvable.push({ builder, templates });
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
