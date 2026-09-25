/**
 * MultiplayerSpawner strict validators: only its own members, the ones
 * doc/classes/MultiplayerSpawner.xml lists without `overrides=`, since the NODE_BASE_TYPES base walk
 * delivers the inherited keys. `spawn_function` (multiplayer_spawner.cpp:176, `PROPERTY_USAGE_NONE`)
 * is never serialised, so no `.tscn` carries a value to validate.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiplayerSpawner', {
  // multiplayer_spawner.cpp:162, `PROPERTY_USAGE_STORAGE | PROPERTY_USAGE_INTERNAL`: the one key
  // that reaches a `.tscn`, since `SceneState::save` skips the EDITOR-only `scenes/N` family (:71-85,
  // object.h:100-103, packed_scene.cpp:864-867). Format only: `add_spawnable_scene` (:97-113)
  // checks `ResourceLoader::exists` only under `is_editor_hint()`.
  _spawnable_scenes: v.packedStringArray('_spawnable_scenes', '"res://a.tscn"'),
  // multiplayer_spawner.cpp:168, NODE_PATH, PROPERTY_HINT_NONE.
  spawn_path: v.nodePath('spawn_path'),
  // multiplayer_spawner.cpp:172, PROPERTY_HINT_RANGE "0,1024,1,or_greater" (or_greater opens the
  // ceiling). set_spawn_limit is a bare `uint32_t` assignment (multiplayer_spawner.h:104), so the
  // floor warns, as CPUParticles2D's `seed` does (cpu_particles_2d.cpp:1502).
  spawn_limit: v.int('spawn_limit', { min: 0, hinted: 'multiplayer_spawner.cpp:172' }),
});
