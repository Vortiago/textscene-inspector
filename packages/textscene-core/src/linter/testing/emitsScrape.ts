/**
 * Scrapes the `(ruleName, severity)` pairs one file names, for
 * `ruleCoverage.emits.test.ts`; `emitsReach.ts` widens it to a closure. The
 * `ruleName` values a user sees are literals inside `check`, so reading them off
 * the source is the only way to hold `meta.emits` honest.
 */

// This module is in the population it scrapes, so every `ruleName` or `severity`
// here sits inside a regex, followed by a backslash no alternative can match.
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { SEVERITIES } from '../types.js';

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
 * Index of the `]` closing the array opening at `open`. String contents are
 * skipped: a bracket in a grounding's `unused` or `because` prose would end the
 * array early, scraping declarations as emissions, or late, deleting real ones.
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
 * Every `emits: [ … ]` array body in `src`, bracket-matched. {@link stripEmits}
 * removes these, and the conditional-spread guard reads them.
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
 * its matching `]`, and the index of `emits:`. It is anchored to a property
 * position and needs a `[`, so an `emits:` in a comment or string cuts nothing.
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
 * Does a scraped name cover a declared one? Only the scraped side can hold a `*`
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

const scrapeCache = new Map<string, EmittedPair[]>();

/**
 * Scrape `(ruleName, severity)` pairs from a file, ignoring its `emits` blocks.
 * Every diagnostic literal writes the severity first, so a name takes the latest
 * severity since the previous name. A name with none is a `rangeAdvisory` arm,
 * a `warning` by construction.
 */
export function scrapePairs(file: string): EmittedPair[] {
  const cached = scrapeCache.get(file);
  if (cached) return cached;
  // Comments first: in prose, a name key before a backtick opens a capture
  // that runs to the next backtick anywhere in the file.
  const src = stripEmits(stripComments(readFileSync(file, 'utf8')));

  // A rule may hoist its name (`const ruleName = \`valid-x${dim}-resources\``)
  // and then use the shorthand in the diagnostic. Resolve those bindings so the
  // name is still visible to the scrape.
  const bindings = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']+)'|`([^`]+)`)/g)) {
    bindings.set(m[1]!, m[2] ?? m[3]!);
  }
  // `(?<!:\s*)` keeps the meta's own `name: ruleName,`, the registry key, out of
  // the scrape. The severity alternation derives from the union, so a new tier
  // cannot drop out of the scrape.
  const token = new RegExp(
    `severity:\\s*'(${SEVERITIES.join('|')})'` +
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
      // An identifier, or the object shorthand. Only a resolved name counts,
      // or this matches a `: string` type and a `.ruleName` passthrough.
      const ident = m[4] ?? 'ruleName';
      const bound = bindings.get(ident);
      if (bound !== undefined) name = normalize(bound);
    }
    // Reset even when the name is unresolvable, or the pending severity goes
    // to the next name scraped in this file.
    const pending = severity;
    severity = null;
    if (name === null) continue;
    pairs.push({ name, severity: pending ?? 'warning' });
  }
  scrapeCache.set(file, pairs);
  return pairs;
}
