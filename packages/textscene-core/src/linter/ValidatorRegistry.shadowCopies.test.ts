/**
 * Meta-guard: no linterParser.ts may re-declare a key that its base chain
 * already carries — a shadow copy silently drifts from the base validator.
 *
 * The text scan is `testing/shadowCopyScan.ts`; what lives here is the
 * inventory of deliberate exceptions and the run against the real tree.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatorRegistry } from './ValidatorRegistry.js';
import { baseChain } from './nodeBaseTypes.js';
import { nodesRoot } from './testing/ruleNameScrape.js';
import {
  extractRegisteredKeys,
  findShadowViolations,
  walkLinterParsers,
} from './testing/shadowCopyScan.js';
import './index.js'; // trigger all validator registrations

/**
 * Keys a subclass re-declares on purpose, as `Type:key`.
 *
 * Empty, and that is the point. The four entries this once held were the
 * fixed-orientation containers, which do not re-declare `vertical` at all —
 * they REMOVE it, via `registerUnavailable`, so there is no shadow to allow.
 * Narrowing has its own mechanism now, which means a re-declaration is once
 * again always the drift this guard exists to catch.
 *
 * Add here only for a subclass that genuinely re-declares a base key and
 * accepts something DIFFERENT, not less; a leaf that accepts less belongs in
 * `registerUnavailable`.
 */
const INTENTIONAL_OVERRIDES = new Set<string>([
  // Godot builds ONE `settings/<i>/…` family cooperatively: each class's
  // property-list override calls its base's and then appends its own leaves
  // (`iterate_ik_3d.cpp:129`, `aim_modifier_3d.cpp:85`,
  // `copy_transform_modifier_3d.cpp:84`). `findValidator` resolves one wildcard
  // per key with no fall-through, so the subclass MUST re-register the prefix
  // to answer for the leaves it adds; letting the base-walk deliver it would
  // mean the subclass's own leaves reach no validator at all.
  //
  // This is the one shape where re-declaring is correct rather than drift, and
  // it is not a licence to accept less: each of these dispatchers hands an
  // unrecognised leaf back to its base via `findValidator('<Base>', key)`, and
  // `settingsFamilySeam.test.ts` asserts under the full barrel that the base's
  // BOUND still fires through the hop. Delete a delegation and that file goes
  // red, so the exemption cannot quietly become a hole.
  //
  // The list is an INVENTORY, so every cooperative pair appears here even when
  // the two classes spell the wildcard differently — `shadowIdentity` reduces
  // both spellings to the prefix they match on precisely so a differently-spelled
  // shadow cannot hide. `ConvertTransformModifier3D:settings/*` over
  // `BoneConstraint3D:settings/#/*` is a TOTAL shadow (the plain prefix matches a
  // superset), and `SplineIK3D:settings/#/*` over `ChainIK3D:settings/*` is a
  // partial one: the glued-index form routes a single leaf segment only, so
  // ChainIK3D's nested `settings/<i>/joints/<j>/bone` keys reach the base by
  // base-walk rather than through the subclass at all.
  'AimModifier3D:settings/#/*',
  'ConvertTransformModifier3D:settings/*',
  'CopyTransformModifier3D:settings/#/*',
  'IterateIK3D:settings/*',
  'SplineIK3D:settings/#/*',
]);

/** Collect all keys registered for a type by walking up its base chain. */
function baseChainKeys(nodeType: string): Set<string> {
  return new Set(baseChain(nodeType).flatMap((ancestor) => validatorRegistry.getOwnKeys(ancestor)));
}

describe('ValidatorRegistry meta-guard: no shadow copies', () => {
  // A scratch chain where 'Child' inherits 'transform': proves the guard fires
  // before trusting the filesystem scan's silence.
  const scratchInherited = (nodeType: string): Set<string> =>
    new Set(nodeType === 'Child' ? ['transform'] : []);

  it('fails on a seeded duplicate key', () => {
    const source = `
      validatorRegistry.registerAll('Child', {
        transform: v.transform3d('transform'),
        own_prop: v.boolean('own_prop'),
      });
    `;
    const violations = findShadowViolations(
      extractRegisteredKeys(source),
      scratchInherited,
      new Set()
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("'Child' re-declares 'transform'");
  });

  it('an INTENTIONAL_OVERRIDES entry suppresses the seeded violation', () => {
    const source = `
      validatorRegistry.registerAll('Child', {
        transform: v.transform3d('transform'),
      });
    `;
    const violations = findShadowViolations(
      extractRegisteredKeys(source),
      scratchInherited,
      new Set(['Child:transform'])
    );
    expect(violations).toHaveLength(0);
  });

  it('sees keys declared after a nested option object', () => {
    // The deleted shadow copies sat at the END of registrations that contain
    // option objects — the extraction must not stop at the first nested `}`.
    const source = `
      validatorRegistry.registerAll('Child', {
        rings: v.int('rings', { min: 1 }),
        transform: v.transform3d('transform'),
      });
    `;
    const parsed = extractRegisteredKeys(source);
    expect(parsed[0]!.keys).toEqual(['rings', 'transform']);
  });

  it('no linterParser.ts re-declares a key that its base chain already registers', () => {
    const files = walkLinterParsers(nodesRoot);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const found = findShadowViolations(
        extractRegisteredKeys(source),
        baseChainKeys,
        INTENTIONAL_OVERRIDES
      );
      violations.push(...found.map((v) => `${file}\n  → ${v}`));
    }

    if (violations.length > 0) {
      throw new Error(
        `Shadow copy anti-pattern detected — remove the duplicate key(s) and let the base-walk deliver them:\n\n${violations.join('\n\n')}`
      );
    }
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
