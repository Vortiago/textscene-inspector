/**
 * Path3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Path3D', {
  curve: v.resourceReference('curve'),
  // path_3d.cpp:263, COLOR, no hint. set_debug_custom_color
  // (path_3d.cpp:175-178) is a bare assignment (plus a debug-material rebuild
  // side effect, not a value check): format-only. Godot's own editor gizmo
  // (path_3d_editor_plugin.cpp:322-325) reads this back for the path line
  // colour when it is not the sentinel Color(0,0,0), so this is the property
  // behind the previewer's hardcoded white gizmo line — a render gap, not a
  // format gap.
  debug_custom_color: v.color('debug_custom_color'),
});
