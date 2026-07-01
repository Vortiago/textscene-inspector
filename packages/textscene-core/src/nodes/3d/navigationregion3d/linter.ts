/** Semantic linter rules for NavigationRegion3D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { makeNavigationRegionLinterRule } from '../../../linter/physics/navigationRegionLinterRule.js';

const navigationRegion3DValidationRule = makeNavigationRegionLinterRule('3D');

ruleRegistry.register(navigationRegion3DValidationRule);

export { navigationRegion3DValidationRule };
