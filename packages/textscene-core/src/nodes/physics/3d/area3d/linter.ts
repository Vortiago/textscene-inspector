/** Semantic linter rules for Area3D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeAreaLinterRule } from '../../../../linter/physics/areaLinterRule.js';

const area3DValidationRule = makeAreaLinterRule('3D');

// Self-register the rule
ruleRegistry.register(area3DValidationRule);

// Export for testing
export { area3DValidationRule };
