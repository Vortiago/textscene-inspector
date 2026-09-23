/**
 * What Godot declares on `Resource`, reached from every resource class. Both are
 * format checks: `set_name` (resource.cpp:180) and `set_local_to_scene` (:643)
 * bare-assign. Never serialised, so absent: `resource_path` (EDITOR without
 * STORAGE, :763) and `resource_scene_unique_id` (USAGE_NONE, :765).
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

validatorRegistry.registerAll('Resource', {
  // resource.cpp:762
  resource_local_to_scene: v.boolean('resource_local_to_scene'),
  // resource.cpp:764, a Variant::STRING, so the `.tscn` literal is quoted.
  resource_name: v.quotedString('resource_name'),
});
