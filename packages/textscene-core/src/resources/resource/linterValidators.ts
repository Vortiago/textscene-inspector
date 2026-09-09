/**
 * What Godot declares on `Resource` itself, so every resource in a `.tscn`
 * validates it.
 *
 * The widest registration in the linter — the base-walk reaches it from every
 * resource class — which is why both entries are format checks with no bound:
 * `set_name` (resource.cpp:180) and `set_local_to_scene` (:643) bare-assign.
 *
 * `resource_path` and `resource_scene_unique_id` are declared beside them and
 * deliberately absent: EDITOR without STORAGE (:763) and USAGE_NONE (:765), so
 * neither is ever serialised.
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

validatorRegistry.registerAll('Resource', {
  // resource.cpp:762
  resource_local_to_scene: v.boolean('resource_local_to_scene'),
  // resource.cpp:764, a Variant::STRING, so the `.tscn` literal is quoted.
  resource_name: v.quotedString('resource_name'),
});
