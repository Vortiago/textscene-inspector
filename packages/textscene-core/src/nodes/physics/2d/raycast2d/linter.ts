/** Semantic linter rules for RayCast2D — built from the shared cast factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCastLinterRule } from '../../../../linter/physics/castLinterRule.js';

const rayCast2DValidationRule = makeCastLinterRule('2D', 'Ray');

ruleRegistry.register(rayCast2DValidationRule);

export { rayCast2DValidationRule };
