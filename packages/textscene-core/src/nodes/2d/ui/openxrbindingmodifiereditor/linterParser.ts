/**
 * OpenXRBindingModifierEditor strict validators for linting.
 *
 * Editor-only class under modules/openxr/editor/ (no scene/gui/ home), so its
 * doc page is modules/openxr/doc_classes/OpenXRBindingModifierEditor.xml
 * rather than doc/classes/. That page lists exactly one member,
 * size_flags_horizontal, tagged overrides="Control": its constructor merely
 * calls set_h_size_flags(Control::SIZE_EXPAND_FILL)
 * (openxr_binding_modifier_editor.cpp:249) to change the inherited default,
 * the same pattern HBoxContainer uses for `vertical`. _bind_methods
 * (openxr_binding_modifier_editor.cpp:226-231) binds two methods and one
 * ADD_SIGNAL only, zero ADD_PROPERTY, and the class declares no
 * _get_property_list/_set/_get override, so it has no serialisable property
 * of its own: everything a `.tscn` can set on it is inherited from
 * PanelContainer up, delivered by the NODE_BASE_TYPES base-walk.
 * PanelContainer and Container register nothing of their own either
 * (ownValidatorCoverage.test.ts's NO_OWN_PROPERTIES), so Control is the
 * nearest ancestor with anything to import.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRBindingModifierEditor', {});
