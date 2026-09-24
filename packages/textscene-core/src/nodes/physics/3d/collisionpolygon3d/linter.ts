/** Semantic linter rules for CollisionPolygon3D: built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCollisionPolygonLinterRule } from '../../../../linter/physics/collisionPolygonLinterRule.js';

const collisionPolygon3DValidationRule = makeCollisionPolygonLinterRule('3D');

ruleRegistry.register(collisionPolygon3DValidationRule);

export { collisionPolygon3DValidationRule };
