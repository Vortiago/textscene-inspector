/** Path3D strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key only if the ancestor is pulled in too:
// without this line only the full barrel registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Path3D', {
  curve: v.resourceReference('curve'),
  // path_3d.cpp:263, COLOR, no hint. set_debug_custom_color (path_3d.cpp:175-178) is a
  // bare assignment plus a debug-material rebuild: format-only.
  // Godot's editor gizmo (path_3d_editor_plugin.cpp:322-325) draws the path line in this
  // colour unless it is Color(0,0,0). The previewer's white line is a render gap.
  debug_custom_color: v.color('debug_custom_color'),
});
