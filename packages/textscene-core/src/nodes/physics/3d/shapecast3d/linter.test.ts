/**
 * The one claim that is ShapeCast3D's alone: this slice registers the shared cast rule under
 * its own name and node type. What the rule does is the factory's behaviour, tested once in
 * linter/physics/castLinterRule.test.ts rather than copied into each of the four casts.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { shapeCast3DValidationRule } from './linter.js';
import './index.linter.js';

describe('ShapeCast3D semantic rule wiring', () => {
  it('registers the shared rule under valid-shapecast3d, for ShapeCast3D alone', () => {
    const registered = ruleRegistry.getRules().find((r) => r.meta.name === 'valid-shapecast3d');
    expect(registered).toBe(shapeCast3DValidationRule);
    expect(registered?.meta.applicableNodeTypes).toEqual(['ShapeCast3D']);
  });
});
