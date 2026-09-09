/** Semantic linter rules for RayCast3D — built from the shared cast factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCastLinterRule } from '../../../../linter/physics/castLinterRule.js';

const rayCast3DValidationRule = makeCastLinterRule('3D', 'Ray');

ruleRegistry.register(rayCast3DValidationRule);

export { rayCast3DValidationRule };
