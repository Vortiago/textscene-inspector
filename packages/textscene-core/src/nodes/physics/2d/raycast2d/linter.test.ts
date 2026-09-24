/**
 * The one claim that is RayCast2D's alone: this slice registers the shared cast rule under
 * its own name and node type. What the rule does is the factory's behaviour, tested once in
 * linter/physics/castLinterRule.test.ts rather than copied into each of the four casts.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rayCast2DValidationRule } from './linter.js';
import './index.linter.js';

describe('RayCast2D semantic rule wiring', () => {
  it('registers the shared rule under valid-raycast2d, for RayCast2D alone', () => {
    const registered = ruleRegistry.getRules().find((r) => r.meta.name === 'valid-raycast2d');
    expect(registered).toBe(rayCast2DValidationRule);
    expect(registered?.meta.applicableNodeTypes).toEqual(['RayCast2D']);
  });
});
