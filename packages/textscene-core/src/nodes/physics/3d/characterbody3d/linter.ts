/** Semantic linter rules for CharacterBody3D: built from the shared 2D/3D factory. */

import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { makeCharacterBodyLinterRule } from '../../../../linter/physics/characterBodyLinterRule.js';

const characterBody3DValidationRule = makeCharacterBodyLinterRule('3D');

ruleRegistry.register(characterBody3DValidationRule);

export { characterBody3DValidationRule };
