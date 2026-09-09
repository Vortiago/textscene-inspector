/** Semantic linter rule for NavigationAgent2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { makeNavigationAgentLinterRule } from '../../../linter/physics/navigationAgentLinterRule.js';

const navigationAgent2DParentRule = makeNavigationAgentLinterRule('2D');

ruleRegistry.register(navigationAgent2DParentRule);

export { navigationAgent2DParentRule };
