/**
 * ShaderGlobalsOverride strict validators. shader_globals_override.cpp binds no `ADD_PROPERTY`, and
 * the XML has no `<members>`: the surface is the `params/<name>` family of a hand-rolled
 * `_get`/`_set`/`_get_property_list` override (shader_globals_override.cpp:51-92,
 * :94-226), registered as one flat `params/*` wildcard dispatcher.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { shape } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * `params/<name>`: accepts every value. `_set` (shader_globals_override.cpp:51)
 * stores any Variant, and `_get_property_list` (:94) types each name from the
 * project's global shader parameters in `project.godot`, outside any `.tscn`.
 * A guessed type would reject legal scenes.
 */
const paramsValidator: PropertyValidator = shape(
  () => null,
  'any Variant — the type lives in project.godot, not the .tscn'
);

validatorRegistry.registerAll('ShaderGlobalsOverride', {
  'params/*': paramsValidator,
});
