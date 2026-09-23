/**
 * OpenXRBindingModifierEditor's strict validators: none of its own. `_bind_methods`
 * (openxr_binding_modifier_editor.cpp:226-231) binds no ADD_PROPERTY and there is no `_get_property_list`,
 * `_set` or `_get`. Its one doc member, `size_flags_horizontal` (modules/openxr/doc_classes/OpenXRBindingModifierEditor.xml),
 * only changes Control's default (openxr_binding_modifier_editor.cpp:249). Control is the nearest ancestor with validators.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRBindingModifierEditor', {});
