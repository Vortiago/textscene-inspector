/**
 * MultiplayerSpawner strict validators: only its own members, the ones
 * doc/classes/MultiplayerSpawner.xml lists without `overrides=`, since the NODE_BASE_TYPES base walk
 * delivers the inherited keys. `spawn_function` (multiplayer_spawner.cpp:176, `PROPERTY_USAGE_NONE`)
 * is never serialised, so no `.tscn` carries a value to validate.
 */

import '../../node/linterParser.js';
import { packedArrayBody, packedArrayForms } from '../../../godot/index.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, shape, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// The forms from the shared builder, so the padding Godot's tokenizer discards
// (`get_token`, variant_parser.cpp:416-418) is legal here too, as in the FileDialog.filters twin.
const SPAWNABLE_SCENES_FORMS = packedArrayForms('PackedStringArray');
// Format only: `add_spawnable_scene` (:97-113) checks `ResourceLoader::exists` only in the editor
// (`is_editor_hint()`), a filesystem check no static bound can ground, so each element is a quoted string.
const QUOTED_ELEMENTS_RE = /^\s*(?:"(?:[^"\\]|\\[\s\S])*"(?:\s*,\s*"(?:[^"\\]|\\[\s\S])*")*\s*)?$/;

/**
 * A string array in any of the three spellings the slot loads. The getter
 * (multiplayer_spawner.cpp:137-144) writes `PackedStringArray(…)`, but `can_convert_strict` accepts
 * ARRAY (variant.cpp:467-473) and `_set_spawnable_scenes` (:146) takes the converted
 * `Vector<String>`, so `Array[String]([…])` and `["res://a.tscn"]` load too.
 */
function packedStringArray(name: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase()}_FORMAT`;
  return shape((key, value, line) => {
    const matched = packedArrayBody(SPAWNABLE_SCENES_FORMS, value);
    if (!matched || !QUOTED_ELEMENTS_RE.test(matched.body)) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be an array of quoted strings like PackedStringArray("res://a.tscn"), Array[String](["res://a.tscn"]) or ["res://a.tscn"], got: ${value}`,
        code
      );
    }
    return null;
  }, 'string array (PackedStringArray(…), Array[String]([…]) or […])');
}

validatorRegistry.registerAll('MultiplayerSpawner', {
  // multiplayer_spawner.cpp:162, `PROPERTY_USAGE_STORAGE | PROPERTY_USAGE_INTERNAL`: the one key
  // that reaches a `.tscn`. The `_spawnable_scene_count`/`scenes/N` family
  // (multiplayer_spawner.cpp:71-85, TOOLS_ENABLED) carries `PROPERTY_USAGE_EDITOR` alone
  // (object.h:100-103), and `SceneState::save` skips it (packed_scene.cpp:864-867).
  _spawnable_scenes: packedStringArray('_spawnable_scenes'),
  // multiplayer_spawner.cpp:168, NODE_PATH, PROPERTY_HINT_NONE.
  spawn_path: v.nodePath('spawn_path'),
  // multiplayer_spawner.cpp:172, PROPERTY_HINT_RANGE "0,1024,1,or_greater" (or_greater opens the
  // ceiling). set_spawn_limit is a bare `uint32_t` assignment (multiplayer_spawner.h:104), so the
  // floor warns, as CPUParticles2D's `seed` does (cpu_particles_2d.cpp:1502).
  spawn_limit: v.int('spawn_limit', { min: 0, hinted: 'multiplayer_spawner.cpp:172' }),
});
