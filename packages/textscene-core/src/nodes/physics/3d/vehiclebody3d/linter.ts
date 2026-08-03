/** Semantic linter rules for VehicleBody3D — built from the shared factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeVehicleBodyLinterRule } from '../../../../linter/physics/vehicleBodyLinterRule.js';

const vehicleBody3DValidationRule = makeVehicleBodyLinterRule('3D');

// Self-register the rule
ruleRegistry.register(vehicleBody3DValidationRule);

// Export for testing
export { vehicleBody3DValidationRule };
