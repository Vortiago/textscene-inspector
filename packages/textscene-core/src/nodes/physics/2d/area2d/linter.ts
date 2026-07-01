/** Semantic linter rules for Area2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeAreaLinterRule } from '../../../../linter/physics/areaLinterRule.js';

const area2DValidationRule = makeAreaLinterRule('2D');

// Self-register the rule
ruleRegistry.register(area2DValidationRule);

// Export for testing
export { area2DValidationRule };
