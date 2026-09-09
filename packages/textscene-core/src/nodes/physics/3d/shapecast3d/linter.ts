/** Semantic linter rules for ShapeCast3D — built from the shared cast factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCastLinterRule } from '../../../../linter/physics/castLinterRule.js';

const shapeCast3DValidationRule = makeCastLinterRule('3D', 'Shape');

ruleRegistry.register(shapeCast3DValidationRule);

export { shapeCast3DValidationRule };
