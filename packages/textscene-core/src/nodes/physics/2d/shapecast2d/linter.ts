/** Semantic linter rules for ShapeCast2D — built from the shared cast factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCastLinterRule } from '../../../../linter/physics/castLinterRule.js';

const shapeCast2DValidationRule = makeCastLinterRule('2D', 'Shape');

ruleRegistry.register(shapeCast2DValidationRule);

export { shapeCast2DValidationRule };
