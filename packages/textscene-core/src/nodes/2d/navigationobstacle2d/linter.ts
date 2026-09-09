/** Semantic linter rules for NavigationObstacle2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { makeNavigationObstacleLinterRule } from '../../../linter/physics/navigationObstacleLinterRule.js';

const navigationObstacle2DCarveRule = makeNavigationObstacleLinterRule('2D');

ruleRegistry.register(navigationObstacle2DCarveRule);

export { navigationObstacle2DCarveRule };
