/**
 * ShapeCast3D wiring: the shared cast factory only reaches a scene if this slice
 * registers it and `index.linter.ts` imports the module. Both are asserted here
 * through the real `Linter`; the rule's behaviour matrix lives beside the
 * factory in linter/physics/castLinterRule.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic, node, scene } from '../../../../linter/testing/testkit.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { shapeCast3DValidationRule } from './linter.js';
import '../../../../linter/index.js';

const LIVE_CAST = scene(
  '[sub_resource type="BoxShape3D" id="Box_1"]',
  node('ShapeCast3D', { shape: 'SubResource("Box_1")', collision_mask: 1, collide_with_bodies: true })
);

describe('ShapeCast3D semantic rule wiring', () => {
  it('is the rule the registry holds for this type, not a second copy', () => {
    const registered = ruleRegistry.getRules().find((r) => r.meta.name === 'valid-shapecast3d');
    expect(registered).toBe(shapeCast3DValidationRule);
    expect(registered?.meta.applicableNodeTypes).toEqual(['ShapeCast3D']);
  });

  it('reaches a scene through Linter, so index.linter.ts imports it', () => {
    expectDiagnostic(
      scene(node('ShapeCast3D', { collide_with_areas: false, collide_with_bodies: false })),
      { ruleName: 'shapecast3d-no-collide-target', nodeType: 'ShapeCast3D' }
    );
  });

  it('asks for the shape Godot itself warns about', () => {
    expectDiagnostic(scene(node('ShapeCast3D', { collision_mask: 1 })), {
      ruleName: 'shapecast3d-missing-shape',
      severity: 'warning',
    });
  });

  it('stays silent on a fully configured cast', () => {
    for (const ruleName of ['shapecast3d-no-collide-target', 'shapecast3d-zero-mask', 'shapecast3d-missing-shape']) {
      expectNoDiagnostic(LIVE_CAST, { ruleName });
    }
  });
});
