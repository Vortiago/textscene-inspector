/**
 * Source scan behind the shadow-copy meta-guard: which keys a `linterParser.ts`
 * re-declares while its base chain already carries them.
 *
 * Pure text work, deliberately separate from the guard that uses it — the same
 * functions run twice, once over a seeded string (to prove the guard fires) and
 * once over the real tree, and those two callers must not be able to drift.
 */

import { walk } from './ruleNameScrape.js';

/**
 * Every `linterParser.ts` under `dir`.
 *
 * The sibling `walk` rather than a local copy, and specifically one that lets
 * an unreadable directory THROW: a walk that swallows the error and returns
 * `[]` turns this guard's own failure into a pass over an empty population.
 */
export const walkLinterParsers = (dir: string): string[] => walk(dir, 'linterParser.ts');

/**
 * Slice of `source` from `start` (just past an opening `{`) to its balanced
 * closing `}`. Good enough for validator registrations: none of the scanned
 * sources put braces inside string literals.
 */
function balancedBody(source: string, start: number): string {
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i);
  }
  return source.slice(start);
}

/**
 * Extract (nodeType, key[]) from a linterParser.ts source file. Finds each
 * `validatorRegistry.registerAll('TypeName', { … })` call, captures the full
 * balanced object literal, and reads only its top-level keys — nested option
 * objects like `v.int('rings', { min: 1 })` are stripped first so keys
 * declared after them are still seen.
 */
export function extractRegisteredKeys(source: string): Array<{ nodeType: string; keys: string[] }> {
  const results: Array<{ nodeType: string; keys: string[] }> = [];
  const headRe = /registerAll\(\s*'([^']+)'\s*,\s*\{/g;
  let head: RegExpExecArray | null;
  while ((head = headRe.exec(source)) !== null) {
    const nodeType = head[1]!;
    let body = balancedBody(source, headRe.lastIndex);
    // Repeatedly drop innermost object literals until only top-level keys remain.
    for (let prev = ''; prev !== body; ) {
      prev = body;
      body = body.replace(/\{[^{}]*\}/g, '');
    }
    const keys: string[] = [];
    const keyRe = /^\s*(?:'([^']+)'|([\w/*]+))\s*:/gm;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyRe.exec(body)) !== null) {
      const key = keyMatch[1] ?? keyMatch[2];
      if (key) keys.push(key);
    }
    results.push({ nodeType, keys });
  }
  return results;
}

/**
 * A key reduced to what it MATCHES ON, so the two spellings of one wildcard
 * family collide.
 *
 * Shadowing is an overlap of matched key SETS, not of registration strings, and
 * `settings/*` (plain prefix) matches a superset of what `settings/#/*` (glued
 * index) does. Comparing the literal strings called those two different keys and
 * saw no shadow: `SplineIK3D:settings/#/*` over `ChainIK3D:settings/*` and
 * `ConvertTransformModifier3D:settings/*` over `BoneConstraint3D:settings/#/*`
 * were both invisible, the second a TOTAL shadow. The `*:` namespace keeps a
 * reduced wildcard from ever colliding with a literal key of the same text.
 */
function shadowIdentity(key: string): string {
  if (key.endsWith('#/*')) return `*:${key.slice(0, -'#/*'.length)}`;
  if (key.endsWith('*')) return `*:${key.slice(0, -1)}`;
  return key;
}

/**
 * The guard itself: every key a registration re-declares while its base chain
 * already carries it is a violation, unless allowlisted as `Type:key`.
 *
 * The allowlist is keyed on the LITERAL registration string, not the reduced
 * one, so an entry is greppable from the source line it exempts.
 */
export function findShadowViolations(
  registrations: Array<{ nodeType: string; keys: string[] }>,
  inheritedKeysOf: (nodeType: string) => Set<string>,
  intentionalOverrides: Set<string>
): string[] {
  const violations: string[] = [];
  for (const { nodeType, keys } of registrations) {
    const inherited = new Set([...inheritedKeysOf(nodeType)].map(shadowIdentity));
    for (const key of keys) {
      if (inherited.has(shadowIdentity(key)) && !intentionalOverrides.has(`${nodeType}:${key}`)) {
        violations.push(`'${nodeType}' re-declares '${key}' which is already in its base chain`);
      }
    }
  }
  return violations;
}
