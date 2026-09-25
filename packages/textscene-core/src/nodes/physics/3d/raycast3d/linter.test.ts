/**
 * The one claim that is RayCast3D's alone: this slice registers the shared cast rule under
 * its own name and node type. What the rule does is the factory's behaviour, tested once in
 * linter/physics/castLinterRule.test.ts rather than copied into each of the four casts.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rayCast3DValidationRule } from './linter.js';
import './index.linter.js';

describe('RayCast3D semantic rule wiring', () => {
  it('registers the shared rule under valid-raycast3d, for RayCast3D alone', () => {
    const registered = ruleRegistry.getRules().find((r) => r.meta.name === 'valid-raycast3d');
    expect(registered).toBe(rayCast3DValidationRule);
    expect(registered?.meta.applicableNodeTypes).toEqual(['RayCast3D']);
  });
});
