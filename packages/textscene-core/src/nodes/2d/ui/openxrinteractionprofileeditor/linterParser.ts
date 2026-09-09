/**
 * OpenXRInteractionProfileEditor strict validators for linting.
 *
 * This class registers no properties of its own. `_bind_methods`
 * (openxr_interaction_profile_editor.cpp:38) binds only three methods
 * (setup, _add_binding, _remove_binding), with no ADD_PROPERTY call anywhere
 * in the file, and neither this class nor its abstract base overrides
 * _get_property_list, _set or _get, so there is no virtual-property path
 * either. Its abstract base, OpenXRInteractionProfileEditorBase, was checked
 * the same way and is equally empty, so it carries no shared tier and no
 * properties are absorbed here that actually belong to it.
 *
 * The whole serialisable surface a scene author can set on this type -
 * HBoxContainer/BoxContainer/Container/Control/CanvasItem/Node - arrives
 * through the NODE_BASE_TYPES base-walk. HBoxContainer is the nearest
 * ancestor that registers anything (it removes `vertical`), so that is the
 * module imported here rather than BoxContainer directly.
 */

import '../hboxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRInteractionProfileEditor', {});
