/**
 * RayCast3D wiring: the shared cast factory only reaches a scene if this slice
 * registers it and `index.linter.ts` imports the module. Both are asserted here
 * through the real `Linter`; the rule's behaviour matrix lives beside the
 * factory in linter/physics/castLinterRule.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic, node, scene } from '../../../../linter/testing/testkit.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rayCast3DValidationRule } from './linter.js';
import '../../../../linter/index.js';

const LIVE_CAST = scene(
  node('RayCast3D', { collision_mask: 1, collide_with_bodies: true })
);

describe('RayCast3D semantic rule wiring', () => {
  it('is the rule the registry holds for this type, not a second copy', () => {
    const registered = ruleRegistry.getRules().find((r) => r.meta.name === 'valid-raycast3d');
    expect(registered).toBe(rayCast3DValidationRule);
    expect(registered?.meta.applicableNodeTypes).toEqual(['RayCast3D']);
  });

  it('reaches a scene through Linter, so index.linter.ts imports it', () => {
    expectDiagnostic(
      scene(node('RayCast3D', { collide_with_areas: false, collide_with_bodies: false })),
      { ruleName: 'raycast3d-no-collide-target', nodeType: 'RayCast3D' }
    );
  });

  it('stays silent on a fully configured cast', () => {
    for (const ruleName of ['raycast3d-no-collide-target', 'raycast3d-zero-mask', 'raycast3d-missing-shape']) {
      expectNoDiagnostic(LIVE_CAST, { ruleName });
    }
  });
});
