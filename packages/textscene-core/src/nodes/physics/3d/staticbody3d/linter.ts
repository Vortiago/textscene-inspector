/** Semantic linter rules for StaticBody3D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeStaticBodyLinterRule } from '../../../../linter/physics/staticBodyLinterRule.js';

const staticBody3DValidationRule = makeStaticBodyLinterRule('3D');

// Self-register the rule
ruleRegistry.register(staticBody3DValidationRule);

// Export for testing
export { staticBody3DValidationRule };
