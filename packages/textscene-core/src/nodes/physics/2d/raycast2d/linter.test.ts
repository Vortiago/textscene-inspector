/**
 * RayCast2D wiring: the shared cast factory only reaches a scene if this slice
 * registers it and `index.linter.ts` imports the module. Both are asserted here
 * through the real `Linter`; the rule's behaviour matrix lives beside the
 * factory in linter/physics/castLinterRule.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic, node, scene } from '../../../../linter/testing/testkit.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rayCast2DValidationRule } from './linter.js';
import '../../../../linter/index.js';

const LIVE_CAST = scene(
  node('RayCast2D', { collision_mask: 1, collide_with_bodies: true })
);

describe('RayCast2D semantic rule wiring', () => {
  it('is the rule the registry holds for this type, not a second copy', () => {
    const registered = ruleRegistry.getRules().find((r) => r.meta.name === 'valid-raycast2d');
    expect(registered).toBe(rayCast2DValidationRule);
    expect(registered?.meta.applicableNodeTypes).toEqual(['RayCast2D']);
  });

  it('reaches a scene through Linter, so index.linter.ts imports it', () => {
    expectDiagnostic(
      scene(node('RayCast2D', { collide_with_areas: false, collide_with_bodies: false })),
      { ruleName: 'raycast2d-no-collide-target', nodeType: 'RayCast2D' }
    );
  });

  it('stays silent on a fully configured cast', () => {
    for (const ruleName of ['raycast2d-no-collide-target', 'raycast2d-zero-mask', 'raycast2d-missing-shape']) {
      expectNoDiagnostic(LIVE_CAST, { ruleName });
    }
  });
});
