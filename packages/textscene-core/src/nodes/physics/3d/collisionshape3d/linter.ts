/** Semantic linter rules for CollisionShape3D: built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionShapeLinterRule } from '../../../../linter/physics/collisionShapeLinterRule.js';

const collisionShape3DValidationRule = makeCollisionShapeLinterRule('3D');

ruleRegistry.register(collisionShape3DValidationRule);

export { collisionShape3DValidationRule };
