/** Semantic linter rules for NavigationObstacle3D, built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { makeNavigationObstacleLinterRule } from '../../../linter/physics/navigationObstacleLinterRule.js';

const navigationObstacle3DCarveRule = makeNavigationObstacleLinterRule('3D');

ruleRegistry.register(navigationObstacle3DCarveRule);

export { navigationObstacle3DCarveRule };
