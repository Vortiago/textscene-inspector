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

export interface EmittedPair {
  readonly name: string;
  readonly severity: string;
}

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

/**
 * Scrape `(ruleName, severity)` pairs from a file, ignoring its `emits` blocks.
 *
 * Every diagnostic object literal in this codebase writes the severity before
 * the name, so a name pairs with the most recent severity seen since the
 * previous one. A name with no preceding severity is a `rangeAdvisory` arm, and
 * those are `warning` by construction (rangeAdvisory.ts).
 */
const scrapeCache = new Map<string, EmittedPair[]>();

export function scrapePairs(file: string): EmittedPair[] {
  const cached = scrapeCache.get(file);
  if (cached) return cached;
  // Block comments first: prose is not code, and it emits nothing. Without this
  // the token regex reads doc text, and a comment mentioning a name key
  // immediately before a backtick opens a capture that runs to the next
  // backtick anywhere in the file — which is how a sentence in types.ts became
  // an "undeclared ruleName".
  const src = stripEmits(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

  // A rule may hoist its name (`const ruleName = \`valid-x${dim}-resources\``)
  // and then use the shorthand in the diagnostic. Resolve those bindings so the
  // name is still visible to the scrape.
  const bindings = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']+)'|`([^`]+)`)/g)) {
    bindings.set(m[1]!, m[2] ?? m[3]!);
  }
  // `(?<!:\s*)` keeps the meta's own `name: ruleName,` out of the emission scrape
  // — that line names the REGISTRY key, not a reported diagnostic.
  const token =
    /severity:\s*'(error|warning)'|ruleName:\s*(?:'([^']+)'|`([^`]+)`|(\w+))|(?<![.\w])(?<!:\s*)ruleName\s*[,}]/g;
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
