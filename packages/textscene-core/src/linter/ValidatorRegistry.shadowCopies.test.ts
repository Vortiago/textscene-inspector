/**
 * Meta-guard: no type may re-declare a key that its base chain already carries,
 * since a shadow copy silently diverges from the base validator.
 *
 * The comparison is `testing/shadowCopyScan.ts`; what lives here is the
 * inventory of deliberate exceptions and the run against the real registry.
 */

import { describe, it, expect } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from './ValidatorRegistry.js';
import { v } from './validators/v.js';
import { findShadowViolations, ownKeyRegistrations } from './testing/shadowCopyScan.js';
import './index.js'; // trigger all validator registrations

/**
 * Keys a subclass re-declares on purpose, as `Type:key`: it accepts something different, not less (a leaf that accepts
 * less belongs in `registerUnavailable`). The set is an inventory of every cooperative pair, however each spells the
 * wildcard, since `shadowIdentity` reduces both spellings to the prefix they match. Every entry must suppress a live
 * shadow: the check below pins the set to the shadows that exist, from both directions.
 */
const INTENTIONAL_OVERRIDES = new Set<string>([
  // Godot builds one `settings/<i>/…` family cooperatively: each property-list override calls its base's, then appends
  // its leaves (`iterate_ik_3d.cpp:129`, `aim_modifier_3d.cpp:85`, `copy_transform_modifier_3d.cpp:84`). `findValidator`
  // resolves one wildcard per key, so the subclass re-registers the prefix, and each dispatcher hands an unknown leaf to
  // `findValidator('<Base>', key)`. `settingsFamilySeam.test.ts` asserts the base's bound still fires through the hop.
  'AimModifier3D:settings/#/*',
  // A total shadow of `BoneConstraint3D:settings/#/*`: the plain prefix matches a superset.
  'ConvertTransformModifier3D:settings/*',
  'CopyTransformModifier3D:settings/#/*',
  'IterateIK3D:settings/*',
  // A partial shadow of `ChainIK3D:settings/*`: the glued-index form routes one leaf segment, so ChainIK3D's nested
  // `settings/<i>/joints/<j>/bone` keys reach the base by base-walk.
  'SplineIK3D:settings/#/*',
]);

/**
 * Collect all keys registered for a type by walking up its base chain.
 *
 * The registry's own chain, not the node table, which would hide every resource
 * shadow.
 */
function baseChainKeys(nodeType: string): Set<string> {
  return new Set(
    validatorRegistry.baseChainOf(nodeType).flatMap((ancestor) => validatorRegistry.getOwnKeys(ancestor))
  );
}

/**
 * Entries that suppress nothing: no shadow the open check finds is spelled that way. A stale exemption would wave the
 * next real shadow of that string through. Exact, not leave-one-out, since the set is read only as `has(label)`, so
 * dropping an entry un-suppresses only its own label. It reads the guard's own labels, so it matches what the guard allows.
 */
function deadOverrides(
  registrations: Array<{ nodeType: string; keys: string[] }>,
  inheritedKeysOf: (nodeType: string) => Set<string>,
  overrides: Set<string>
): string[] {
  const shadowed = new Set(
    findShadowViolations(registrations, inheritedKeysOf, new Set()).map(({ label }) => label)
  );
  return [...overrides].filter((entry) => !shadowed.has(entry));
}

describe('ValidatorRegistry meta-guard: no shadow copies', () => {
  // A scratch chain where 'Child' inherits 'transform': proves the guard fires
  // before trusting the real registry's silence.
  const scratchInherited = (nodeType: string): Set<string> =>
    new Set(nodeType === 'Child' ? ['transform'] : []);

  it('fails on a seeded duplicate key', () => {
    const violations = findShadowViolations(
      [{ nodeType: 'Child', keys: ['transform', 'own_prop'] }],
      scratchInherited,
      new Set()
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("'Child' re-declares 'transform'");
    // The label is what an exemption is matched against, so its spelling is load-bearing.
    expect(violations[0]?.label).toBe('Child:transform');
  });

  it('an INTENTIONAL_OVERRIDES entry suppresses the seeded violation', () => {
    const violations = findShadowViolations(
      [{ nodeType: 'Child', keys: ['transform'] }],
      scratchInherited,
      new Set(['Child:transform'])
    );
    expect(violations).toHaveLength(0);
  });

  it('names the entry that suppresses nothing, and keeps the one that does', () => {
    const dead = deadOverrides(
      [{ nodeType: 'Child', keys: ['transform'] }],
      scratchInherited,
      new Set(['Child:transform', 'Child:own_prop'])
    );
    expect(dead).toEqual(['Child:own_prop']);
  });

  it('sees a key a spread contributed, which a source scrape cannot', () => {
    // Why the own half reads the registry rather than the source text: a shared
    // key group handed to `registerAll`, spread as here or as its own argument,
    // declares its keys with no `key:` line to find.
    const SHARED_KEYS = { transform: v.transform3d('transform') };
    const scratch = new ValidatorRegistry({ Child: 'Base' });
    scratch.registerAll('Base', { transform: v.transform3d('transform') });
    scratch.registerAll('Child', { ...SHARED_KEYS, own_prop: v.boolean('own_prop') });

    const violations = findShadowViolations(
      ownKeyRegistrations(scratch),
      (nodeType) => new Set(nodeType === 'Child' ? scratch.getOwnKeys('Base') : []),
      new Set()
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("'Child' re-declares 'transform'");
  });

  it('no type re-declares a key that its base chain already registers', () => {
    const registrations = ownKeyRegistrations(validatorRegistry);
    // The population floor, asserted on the array the guard is about to read: a
    // registry that never loaded reports no shadows just as convincingly as a
    // clean one.
    expect(registrations.length).toBeGreaterThan(200);

    const violations = findShadowViolations(registrations, baseChainKeys, INTENTIONAL_OVERRIDES);

    if (violations.length > 0) {
      throw new Error(
        `Shadow copy anti-pattern detected — remove the duplicate key(s) and let the base-walk deliver them:\n\n${violations.map(({ message }) => message).join('\n\n')}`
      );
    }
  });

  it('holds no INTENTIONAL_OVERRIDES entry that exempts nothing', () => {
    const registrations = ownKeyRegistrations(validatorRegistry);
    expect(registrations.length).toBeGreaterThan(200);

    const dead = deadOverrides(registrations, baseChainKeys, INTENTIONAL_OVERRIDES).map(
      (entry) => `${entry} suppresses no shadow the live registry still has`
    );

    expect(dead).toEqual([]);
  });

  it('Light3D validators are reachable for every concrete light subclass via the base-walk', () => {
    const lightLeaves = ['DirectionalLight3D', 'OmniLight3D', 'SpotLight3D', 'AreaLight3D'];
    const sharedKeys = [
      'light_energy',
      'light_color',
      'shadow_enabled',
      'shadow_opacity',
      'shadow_blur',
    ];

    for (const lightType of lightLeaves) {
      for (const key of sharedKeys) {
        const validator = validatorRegistry.findValidator(lightType, key);
        expect(
          validator,
          `'${key}' should be reachable for ${lightType} via the base-walk`
        ).not.toBeNull();
      }
    }
  });
});
