/**
 * The one claim that is RayCast2D's alone: this slice contributes the shared cast
 * rule to the registry under its own name and node type.
 *
 * Everything the rule DOES — which conditions fire, on which family, with which
 * severity — is one factory's behaviour and is tested once beside it, in
 * linter/physics/castLinterRule.test.ts. Restating it here would be four copies
 * of one matrix, and the copies drift: an earlier draft of this file asserted
 * that a ray cast stays silent on `raycast2d-missing-shape`, a rule only the
 * shape casts can emit, so the assertion could never fail.
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
