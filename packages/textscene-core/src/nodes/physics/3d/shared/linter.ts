/** The CollisionObject3D configuration warning, reaching every 3D collision object. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionObjectLinterRule } from '../../../../linter/physics/collisionObjectLinterRule.js';

const collisionObject3DValidationRule = makeCollisionObjectLinterRule('3D');

ruleRegistry.register(collisionObject3DValidationRule);

export { collisionObject3DValidationRule };
