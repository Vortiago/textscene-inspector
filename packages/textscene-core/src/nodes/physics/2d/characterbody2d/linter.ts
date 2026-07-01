/** Semantic linter rules for CharacterBody2D — built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCharacterBodyLinterRule } from '../../../../linter/physics/characterBodyLinterRule.js';

const characterBody2DValidationRule = makeCharacterBodyLinterRule('2D');

// Self-register the rule
ruleRegistry.register(characterBody2DValidationRule);

// Export for testing
export { characterBody2DValidationRule };
