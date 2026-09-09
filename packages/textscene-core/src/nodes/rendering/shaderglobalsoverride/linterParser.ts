/**
 * ShaderGlobalsOverride strict validators for linting.
 *
 * This class binds ZERO `ADD_PROPERTY` calls (shader_globals_override.cpp has
 * no `_bind_methods` property block beyond `ADD_SIGNAL`-free method binding) and
 * has no XML `<members>` of its own. Its whole serialisable surface is a single
 * `params/<name>` family, reached through the fourth route: a hand-rolled
 * `_get`/`_set`/`_get_property_list` override (shader_globals_override.cpp:51-92,
 * :94-226), never underscore-missing here but still invisible to an
 * `ADD_PROPERTY` grep.
 *
 * `_get_property_list` (:94) enumerates the CURRENT PROJECT's global shader
 * parameters (`RS::global_shader_parameter_get_list`) and gives each one
 * `params/<name>` with the Variant type that PARAMETER declares in
 * `project.godot` — information that lives outside any `.tscn` this linter
 * reads. So the only honest claim from the file alone is that the key exists;
 * this repo cannot know, and must not guess, which of the ~20 Variant shapes
 * `_get_property_list` would have assigned it. `settingsFamilySeam.test.ts` and
 * `ValidatorRegistry`'s existing non-indexed wildcard shape (`prefix/*`, the
 * same one `MeshInstance3D.surface_material_override/*` uses) already cover
 * exactly this: a single flat dispatcher under the `params/` prefix, with no
 * per-name leaf table, since there IS no per-name knowledge to hold one.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { shape } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * `params/<name>`: accepts every value. `_set` (shader_globals_override.cpp:51)
 * takes ANY Variant and stores it verbatim — there is no format this file can
 * check without knowing the project's declared type for `<name>`, and a
 * validator that guessed one would reject legal scenes it had guessed wrong
 * about. This is the honest whole truth, not a placeholder.
 */
const paramsValidator: PropertyValidator = shape(
  () => null,
  'any Variant — the type lives in project.godot, not the .tscn'
);

validatorRegistry.registerAll('ShaderGlobalsOverride', {
  'params/*': paramsValidator,
});
