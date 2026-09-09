/**
 * ConfirmationDialog strict validators for linting.
 *
 * Declare only ConfirmationDialog's OWN members — the ones doc/classes/ConfirmationDialog.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Of ConfirmationDialog's 4 documented members, 3 carry `overrides="Window"` and
 * are skipped here — they are default-value overrides already validated on
 * Window: min_size, size, title. Only cancel_button_text is genuinely its own,
 * bound in scene/gui/dialogs.cpp's ConfirmationDialog::_bind_methods with a
 * plain ADD_PROPERTY (no PROPERTY_HINT_RANGE, no PROPERTY_USAGE_NONE), so it is
 * a bare String check.
 *
 * AcceptDialog is ConfirmationDialog's own base, so chain to it here rather
 * than re-declaring dialog_text/ok_button_text/etc. or Window's keys beneath it.
 */

import '../acceptdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('ConfirmationDialog', {
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "cancel_button_text"), "set_cancel_button_text", "get_cancel_button_text");
  cancel_button_text: v.quotedString('cancel_button_text'),
});
