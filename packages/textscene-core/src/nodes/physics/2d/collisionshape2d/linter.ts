/** Semantic linter rules for CollisionShape2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionShapeLinterRule } from '../../../../linter/physics/collisionShapeLinterRule.js';

const collisionShape2DValidationRule = makeCollisionShapeLinterRule('2D');

// Self-register the rule
ruleRegistry.register(collisionShape2DValidationRule);

// Export for testing
export { collisionShape2DValidationRule };
