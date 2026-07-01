/** Semantic linter rules for StaticBody2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeStaticBodyLinterRule } from '../../../../linter/physics/staticBodyLinterRule.js';

const staticBody2DValidationRule = makeStaticBodyLinterRule('2D');

// Self-register the rule
ruleRegistry.register(staticBody2DValidationRule);

// Export for testing
export { staticBody2DValidationRule };
