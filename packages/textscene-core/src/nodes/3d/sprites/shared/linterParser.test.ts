/**
 * The SpriteBase3D set must reach its subclasses, which is the whole point of
 * the tier. Assert through `findValidator` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';
// Both heirs, so the "no re-declaration" and "identical function" checks below
// are real: without these, `getOwnKeys` on either leaf would be trivially
// empty in this test file's own module graph and the assertion would pass
// vacuously.
import '../../sprite3d/linterParser.js';
import '../../animatedsprite3d/linterParser.js';

/**
 * Every key SpriteBase3D binds, read from its ADD_PROPERTY calls.
 *
 * Set exactly ONE of these two, from the source rather than from expectation:
 * fill KEYS, or set DECLARES_NOTHING when the class binds no ADD_PROPERTY at all
 * (Godot has many: a themed spacer whose whole surface is theme items, an
 * orientation subclass that only fixes an inherited default). Leaving both unset
 * is red on purpose. Do NOT delete an assertion to go green: an empty KEYS
 * against an empty registerAll passes vacuously, which is what the pairing
 * below exists to prevent.
 */
const KEYS: string[] = [
  'alpha_antialiasing_edge',
  'alpha_antialiasing_mode',
  'alpha_cut',
  'alpha_hash_scale',
  'alpha_scissor_threshold',
  'axis',
  'billboard',
  'centered',
  'double_sided',
  'fixed_size',
  'flip_h',
  'flip_v',
  'modulate',
  'no_depth_test',
  'offset',
  'pixel_size',
  'render_priority',
  'shaded',
  'texture_filter',
  'transparent',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;
const LEAVES = ["AnimatedSprite3D","Sprite3D"] as const;

describe('SpriteBase3D shared validators', () => {
  it('registers exactly what SpriteBase3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SpriteBase3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it.each(LEAVES)(
    '%s resolves every key to SpriteBase3D\'s own function, never a leaf shadow',
    (nodeType) => {
      // Guards the guard: if the leaf's own module never actually registered
      // anything in THIS test file's module graph, `not.toContain(key)` below
      // would pass vacuously for every key, regardless of shadowing.
      expect(
        validatorRegistry.getOwnKeys(nodeType).length,
        `${nodeType} registered no validators of its own in this test's module graph`
      ).toBeGreaterThan(0);
      for (const key of KEYS) {
        const owned = validatorRegistry.findValidator('SpriteBase3D', key);
        expect(owned, `SpriteBase3D does not declare '${key}'`).not.toBeNull();
        // The SAME function, not merely some validator: a shadowing copy on the
        // leaf would answer here while drifting from the tier's rule.
        expect(validatorRegistry.findValidator(nodeType, key)).toBe(owned);
        expect(validatorRegistry.getOwnKeys(nodeType)).not.toContain(key);
      }
    }
  );

  it('AnimatedSprite3D and Sprite3D resolve every shared key to the identical function', () => {
    // The concrete regression this tier closes: before it existed,
    // findValidator('AnimatedSprite3D', 'centered') was null while Sprite3D's
    // linterParser.ts inlined several of these keys as its own, so the two
    // leaves disagreed about every one of them.
    for (const key of KEYS) {
      const sprite3d = validatorRegistry.findValidator('Sprite3D', key);
      expect(sprite3d, `Sprite3D does not resolve '${key}'`).not.toBeNull();
      expect(validatorRegistry.findValidator('AnimatedSprite3D', key)).toBe(sprite3d);
    }
  });
});
