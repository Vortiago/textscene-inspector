/**
 * Source scrape of the `(ruleName, severity)` pairs ONE file names, behind
 * `ruleCoverage.emits.test.ts`. Widening that to a rule's whole import closure
 * is `emitsReach.ts`.
 *
 * `meta.name` is the registry key; the `ruleName` values a user sees are string
 * literals inside `check`. Reading them back off the source is the only way to
 * hold `meta.emits` honest, and every step below exists because a cheaper
 * version of it silently stopped seeing real diagnostics.
 *
 * This module is itself part of the population it scrapes (the walk covers all
 * of `src/linter`), so it deliberately holds no `ruleName: '…'` or
 * `severity: '…'` literal of its own — every occurrence here is inside a regex,
 * where the next character is a backslash and no alternative can match.
 */

import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { SEVERITY_ORDER } from '../types.js';

export interface EmittedPair {
  readonly name: string;
  readonly severity: string;
}

/** Index of the quote closing the string or template opening at `open`. */
function endOfString(src: string, open: number): number {
  const quote = src[open];
  for (let i = open + 1; i < src.length; i++) {
    if (src[i] === '\\') {
      i++;
      continue;
    }
    if (src[i] === quote) return i;
  }
  return src.length;
}

/**
 * Index of the `]` closing the array opening at `open`.
 *
 * String and template contents are skipped rather than counted. A grounding's
 * `unused`/`because` clause is free prose, and a bracket in one moves the end
 * of the array either way: a `]` closes it early and leaves the rest of the
 * DECLARATIONS in the scraped text, where they read as emissions the check
 * function never makes; a `[` runs it past the end and deletes real
 * diagnostics from the scrape instead.
 */
function endOfArray(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = endOfString(src, i);
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return i;
  }
  return src.length;
}

/**
 * Every `emits: [ … ]` array body in `src`, bracket-matched.
 *
 * Shared by {@link stripEmits} and by the conditional-spread guard, which asks
 * of the same text the opposite question: one removes these before scraping,
 * the other reads what is inside them.
 */
export function emitsArrays(src: string): string[] {
  const out: string[] = [];
  forEachEmitsArray(src, (open, close) => out.push(src.slice(open + 1, close)));
  return out;
}

/**
 * Remove every `emits: [ … ]` array before scraping, else the guard validates
 * its own declarations. Bracket-matched rather than regex'd: an emits array may
 * be one line (`emits: [{ ruleName, severity: 'error' }]`) or many, and may
 * contain nested brackets.
 */
export function stripEmits(src: string): string {
  // Anchored to a property position (line start or after `{`/`,`) and required to
  // be followed by `[`. A bare indexOf also matched `emits:` inside a comment or
  // string and then cut everything up to the next `]`, silently deleting real
  // diagnostics from the scrape and disabling the guard for them.
  let out = '';
  let index = 0;
  forEachEmitsArray(src, (_open, close, at) => {
    out += src.slice(index, at);
    index = close + 1;
  });
  return out + src.slice(index);
}

/**
 * Call `visit(open, close, at)` for each `emits: [ … ]` array: the `[` index,
 * its matching `]`, and the index of `emits:` itself.
 *
 * Anchored to a property position (line start or after `{`/`,`) and required to
 * be followed by `[`. A bare indexOf also matched `emits:` inside a comment or
 * string and then cut everything up to the next `]`, silently deleting real
 * diagnostics from the scrape and disabling the guard for them.
 */
function forEachEmitsArray(
  src: string,
  visit: (open: number, close: number, at: number) => void
): void {
  const opener = /(?:^|[{,])\s*emits:\s*\[/gm;
  let index = 0;
  for (;;) {
    opener.lastIndex = index;
    const match = opener.exec(src);
    if (!match) return;
    const at = match.index + match[0].indexOf('emits:');
    const open = src.indexOf('[', at);
    const close = endOfArray(src, open);
    visit(open, close, at);
    index = close + 1;
  }
}

/** A `${…}` interpolation stands for any prefix: `${prefix}-inactive` -> `*-inactive`. */
const normalize = (name: string) => name.replace(/\$\{[^}]+\}/g, '*');

/**
 * Does a SCRAPED name cover a DECLARED one? Only the scraped side can hold a `*`
 * (normalize() runs on source text; `meta.emits` values are runtime strings), so
 * the match is one-directional: `*-negative-energy` covers the declared literal
 * `omnilight3d-negative-energy`.
 */
export function pairMatches(scraped: string, declared: string): boolean {
  if (scraped === declared) return true;
  if (!scraped.includes('*')) return false;
  const pattern = scraped
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${pattern}$`).test(declared);
}

/** The severity literals a push site can carry, from the union itself. */
const SEVERITY_NAMES = Object.keys(SEVERITY_ORDER);

const scrapeCache = new Map<string, EmittedPair[]>();

/**
 * Scrape `(ruleName, severity)` pairs from a file, ignoring its `emits` blocks.
 *
 * Every diagnostic object literal in this codebase writes the severity before
 * the name, so a name pairs with the most recent severity seen since the
 * previous one. A name with no preceding severity is a `rangeAdvisory` arm, and
 * those are `warning` by construction (rangeAdvisory.ts).
 */
export function scrapePairs(file: string): EmittedPair[] {
  const cached = scrapeCache.get(file);
  if (cached) return cached;
  // Block comments first: prose is not code, and it emits nothing. Without this
  // the token regex reads doc text, and a comment mentioning a name key
  // immediately before a backtick opens a capture that runs to the next
  // backtick anywhere in the file — which is how a sentence in types.ts became
  // an "undeclared ruleName".
  const src = stripEmits(stripComments(readFileSync(file, 'utf8')));

  // A rule may hoist its name (`const ruleName = \`valid-x${dim}-resources\``)
  // and then use the shorthand in the diagnostic. Resolve those bindings so the
  // name is still visible to the scrape.
  const bindings = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']+)'|`([^`]+)`)/g)) {
    bindings.set(m[1]!, m[2] ?? m[3]!);
  }
  // `(?<!:\s*)` keeps the meta's own `name: ruleName,` out of the emission scrape
  // — that line names the REGISTRY key, not a reported diagnostic. The severity
  // alternation is DERIVED from the union: spelled out here, a fourth tier would
  // compile everywhere and silently drop out of this scraper's population.
  const token = new RegExp(
    `severity:\\s*'(${SEVERITY_NAMES.join('|')})'` +
      "|ruleName:\\s*(?:'([^']+)'|`([^`]+)`|(\\w+))" +
      '|(?<![.\\w])(?<!:\\s*)ruleName\\s*[,}]',
    'g'
  );
  const pairs: EmittedPair[] = [];
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
      // An identifier, or the object shorthand. Only a name we can actually
      // resolve counts — otherwise this matches a `: string` type declaration
      // and a `.ruleName` passthrough.
      const ident = m[4] ?? 'ruleName';
      const bound = bindings.get(ident);
      if (bound !== undefined) name = normalize(bound);
    }
    // Reset even when the name is unresolvable: leaving the pending severity in
    // place attributed it to the NEXT name scraped in this file.
    const pending = severity;
    severity = null;
    if (name === null) continue;
    pairs.push({ name, severity: pending ?? 'warning' });
  }
  scrapeCache.set(file, pairs);
  return pairs;
}
