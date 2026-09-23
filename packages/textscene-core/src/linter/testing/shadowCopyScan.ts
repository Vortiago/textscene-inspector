/**
 * The shadow-copy meta-guard's comparison: which keys a type re-declares while
 * its base chain already carries them. Both halves read the live registry, since
 * a key from a `...spread` in `registerAll` has no `key:` line to scrape. It runs
 * over a scratch registry, to prove the guard fires, and over the real one.
 */

import type { ValidatorRegistry } from '../ValidatorRegistry.js';
import { registeredTypes } from '../registryPopulation.js';

/** What each registered type declares of its own, as the guard's input. */
export function ownKeyRegistrations(
  registry: ValidatorRegistry
): Array<{ nodeType: string; keys: string[] }> {
  return registeredTypes('declaring', registry)
    .map((nodeType) => ({ nodeType, keys: registry.getOwnKeys(nodeType) }));
}

/**
 * A key reduced to what it matches on, since shadowing is an overlap of matched
 * key sets: `settings/*` matches a superset of `settings/#/*`, as in
 * `ConvertTransformModifier3D` over `BoneConstraint3D`. The `*:` namespace keeps
 * a reduced wildcard apart from a literal key of the same text.
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
 * Every key a registration re-declares while its base chain carries it, unless
 * allowlisted as `Type:key`. The allowlist and `label` use the literal, unreduced
 * registration string, so an entry is greppable from the line it exempts.
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
