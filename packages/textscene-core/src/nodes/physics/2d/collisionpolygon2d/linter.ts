/** Semantic linter rules for CollisionPolygon2D: built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionPolygonLinterRule } from '../../../../linter/physics/collisionPolygonLinterRule.js';

const collisionPolygon2DValidationRule = makeCollisionPolygonLinterRule('2D');

ruleRegistry.register(collisionPolygon2DValidationRule);

export { collisionPolygon2DValidationRule };
