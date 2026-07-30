/** Semantic linter rules for VehicleWheel3D — built from the shared factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeVehicleWheelLinterRule } from '../../../../linter/physics/vehicleWheelLinterRule.js';

const vehicleWheel3DValidationRule = makeVehicleWheelLinterRule('3D');

// Self-register the rule
ruleRegistry.register(vehicleWheel3DValidationRule);

// Export for testing
export { vehicleWheel3DValidationRule };
