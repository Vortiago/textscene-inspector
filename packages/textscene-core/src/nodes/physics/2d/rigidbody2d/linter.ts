/** Semantic linter rules for RigidBody2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeRigidBodyLinterRule } from '../../../../linter/physics/rigidBodyLinterRule.js';

const rigidBody2DValidationRule = makeRigidBodyLinterRule('2D');

// Self-register the rule
ruleRegistry.register(rigidBody2DValidationRule);

// Export for testing
export { rigidBody2DValidationRule };
