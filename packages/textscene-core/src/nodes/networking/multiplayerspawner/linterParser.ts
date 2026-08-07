/**
 * MultiplayerSpawner strict validators for linting.
 *
 * Declare only MultiplayerSpawner's OWN members — the ones doc/classes/MultiplayerSpawner.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `spawn_function` (multiplayer_spawner.cpp:176, `PROPERTY_USAGE_NONE`) is
 * skipped: Godot never serialises it, so no `.tscn` can carry a value to
 * validate.
 *
 * The `_spawnable_scene_count`/`scenes/N` family from `_get_property_list`
 * (multiplayer_spawner.cpp:71-85, `#ifdef TOOLS_ENABLED`) looks like the
 * indexed family this group was told to expect, but every entry it pushes
 * carries `PROPERTY_USAGE_EDITOR` alone — no `PROPERTY_USAGE_STORAGE`
 * (object.h:100-103) — and `SceneState::save`'s node-property loop
 * (packed_scene.cpp:864-867) skips any property without that bit. That family
 * is editor-inspector plumbing for the "Add Spawnable Scene" button; it never
 * reaches a `.tscn`. The property that DOES reach one is the ordinary
 * `ADD_PROPERTY` at :162 below: a flat, non-indexed `_spawnable_scenes`.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, shape, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * `PackedStringArray("res://a.tscn", "uid://abc123", …)` — the getter behind
 * `_spawnable_scenes` (multiplayer_spawner.cpp:137-144) returns a plain
 * `Vector<String>`, not a `TypedArray`, so `Array[String]([…])` never applies
 * here (rule 6: the getter decides the spelling).
 *
 * Format only: `_set_spawnable_scenes` → `add_spawnable_scene` (:97-113) only
 * `ERR_FAIL_COND`s on `ResourceLoader::exists`, and only
 * `if (Engine::get_singleton()->is_editor_hint())` — a runtime/editor-state
 * check on the filesystem, not a value the static linter can ground a bound
 * on, so every element just needs to be a quoted string.
 */
const PACKED_STRING_ARRAY_RE =
  /^PackedStringArray\(\s*(?:"(?:[^"\\]|\\[\s\S])*"(?:\s*,\s*"(?:[^"\\]|\\[\s\S])*")*\s*)?\)$/;

function packedStringArray(name: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase()}_FORMAT`;
  return shape((key, value, line) => {
    if (!PACKED_STRING_ARRAY_RE.test(value.trim())) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a PackedStringArray of quoted strings like PackedStringArray("res://a.tscn"), got: ${value}`,
        code
      );
    }
    return null;
  }, 'PackedStringArray("res://a.tscn", …)');
}

validatorRegistry.registerAll('MultiplayerSpawner', {
  // multiplayer_spawner.cpp:162, ADD_PROPERTY(PACKED_STRING_ARRAY, "_spawnable_scenes",
  // PROPERTY_USAGE_STORAGE | PROPERTY_USAGE_INTERNAL) — the single flat key that
  // actually reaches a `.tscn`. See the module doc comment above for why the
  // `_get_property_list` family does not.
  _spawnable_scenes: packedStringArray('_spawnable_scenes'),
  // multiplayer_spawner.cpp:168, NODE_PATH, PROPERTY_HINT_NONE.
  spawn_path: v.nodePath('spawn_path'),
  // multiplayer_spawner.cpp:172, PROPERTY_HINT_RANGE "0,1024,1,or_greater"
  // (or_greater opens the ceiling). set_spawn_limit is a bare `uint32_t`
  // assignment (multiplayer_spawner.h:104) — no ERR_FAIL, no clamp — so the
  // floor is a warning, matching CPUParticles2D's `seed` precedent for a bare
  // uint32_t parameter (cpu_particles_2d.cpp:1502).
  spawn_limit: v.int('spawn_limit', { min: 0, hinted: 'multiplayer_spawner.cpp:172' }),
});
