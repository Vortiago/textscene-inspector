/** Semantic linter rules for NavigationRegion2D, built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { makeNavigationRegionLinterRule } from '../../../linter/physics/navigationRegionLinterRule.js';

const navigationRegion2DValidationRule = makeNavigationRegionLinterRule('2D');

ruleRegistry.register(navigationRegion2DValidationRule);

export { navigationRegion2DValidationRule };
