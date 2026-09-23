/** Semantic linter rule for NavigationAgent3D, built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { makeNavigationAgentLinterRule } from '../../../linter/physics/navigationAgentLinterRule.js';

const navigationAgent3DParentRule = makeNavigationAgentLinterRule('3D');

ruleRegistry.register(navigationAgent3DParentRule);

export { navigationAgent3DParentRule };
