/** The CollisionObject2D configuration warning, reaching every 2D collision object. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionObjectLinterRule } from '../../../../linter/physics/collisionObjectLinterRule.js';

const collisionObject2DValidationRule = makeCollisionObjectLinterRule('2D');

ruleRegistry.register(collisionObject2DValidationRule);

export { collisionObject2DValidationRule };
