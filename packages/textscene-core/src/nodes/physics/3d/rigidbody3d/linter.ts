/** Semantic linter rules for RigidBody3D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeRigidBodyLinterRule } from '../../../../linter/physics/rigidBodyLinterRule.js';

const rigidBody3DValidationRule = makeRigidBodyLinterRule('3D');

// Self-register the rule
ruleRegistry.register(rigidBody3DValidationRule);

// Export for testing
export { rigidBody3DValidationRule };
