/**
 * The comparison behind the shadow-copy meta-guard: which keys a type
 * re-declares while its base chain already carries them.
 *
 * Both halves read the LIVE registry. An earlier version scraped literal `key:`
 * lines out of each `linterParser.ts` for the own half while the inherited half
 * already read the registry, and that asymmetry was a hole: a key contributed by
 * a `...spread` inside `registerAll` has no `key:` line to scrape, so twenty
 * registrations were invisible and could shadow a base undetected.
 *
 * Kept separate from the guard that uses it so the same functions run twice,
 * once over a scratch registry (to prove the guard fires) and once over the real
 * one, and those two callers cannot drift.
 */

import type { ValidatorRegistry } from '../ValidatorRegistry.js';

/** What each registered type declares of its own, as the guard's input. */
export function ownKeyRegistrations(
  registry: ValidatorRegistry
): Array<{ nodeType: string; keys: string[] }> {
  return registry
    .getRegisteredNodeTypes()
    .map((nodeType) => ({ nodeType, keys: registry.getOwnKeys(nodeType) }));
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
  if (key.endsWith('#/**')) return `*:${key.slice(0, -'#/**'.length)}`;
  if (key.endsWith('#/*')) return `*:${key.slice(0, -'#/*'.length)}`;
  if (key.endsWith('*')) return `*:${key.slice(0, -1)}`;
  // `pattern_#`: a glued index that ends the key, so the prefix alone is what it
  // matches on.
  if (key.endsWith('#')) return `*:${key.slice(0, -1)}`;
  return key;
}

/** One shadow, as both the allowlist's key for it and the report line. */
export interface ShadowViolation {
  /** `Type:key`, the exact string an exemption is spelled as. */
  label: string;
  message: string;
}

/**
 * The guard itself: every key a registration re-declares while its base chain
 * already carries it is a violation, unless allowlisted as `Type:key`.
 *
 * The allowlist is keyed on the LITERAL registration string, not the reduced
 * one, so an entry is greppable from the source line it exempts — and `label`
 * hands that same unreduced string back, so a caller can ask which exemptions
 * matched without parsing `message`.
 */
export function findShadowViolations(
  registrations: Array<{ nodeType: string; keys: string[] }>,
  inheritedKeysOf: (nodeType: string) => Set<string>,
  intentionalOverrides: Set<string>
): ShadowViolation[] {
  const violations: ShadowViolation[] = [];
  for (const { nodeType, keys } of registrations) {
    const inherited = new Set([...inheritedKeysOf(nodeType)].map(shadowIdentity));
    for (const key of keys) {
      const label = `${nodeType}:${key}`;
      if (inherited.has(shadowIdentity(key)) && !intentionalOverrides.has(label)) {
        violations.push({
          label,
          message: `'${nodeType}' re-declares '${key}' which is already in its base chain`,
        });
      }
    }
  }
  return violations;
}
