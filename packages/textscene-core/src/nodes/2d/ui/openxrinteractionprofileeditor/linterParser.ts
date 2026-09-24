/**
 * OpenXRInteractionProfileEditor's strict validators: none of its own. `_bind_methods`
 * (openxr_interaction_profile_editor.cpp:38) binds three methods and no ADD_PROPERTY, and neither it nor its
 * abstract OpenXRInteractionProfileEditorBase overrides `_get_property_list`, `_set` or `_get`. HBoxContainer,
 * which removes `vertical`, is the nearest ancestor with validators, so this imports it.
 */

import '../hboxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRInteractionProfileEditor', {});
