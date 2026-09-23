/** Semantic linter rules for CollisionShape2D: built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionShapeLinterRule } from '../../../../linter/physics/collisionShapeLinterRule.js';

const collisionShape2DValidationRule = makeCollisionShapeLinterRule('2D');

ruleRegistry.register(collisionShape2DValidationRule);

export { collisionShape2DValidationRule };
