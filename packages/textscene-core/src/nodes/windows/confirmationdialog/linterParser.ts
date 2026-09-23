/**
 * ConfirmationDialog strict validators. Its one own member (no `overrides=` in
 * doc/classes/ConfirmationDialog.xml) is `cancel_button_text`, a plain ADD_PROPERTY
 * in scene/gui/dialogs.cpp. The base-walk through AcceptDialog delivers the rest.
 */

import '../acceptdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('ConfirmationDialog', {
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "cancel_button_text"), "set_cancel_button_text", "get_cancel_button_text");
  cancel_button_text: v.quotedString('cancel_button_text'),
});
