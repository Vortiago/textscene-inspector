/**
 * AcceptDialog strict validators for linting.
 *
 * Declare only AcceptDialog's OWN members — the ones doc/classes/AcceptDialog.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Of AcceptDialog's 13 documented members, 8 carry `overrides="Window"` and are
 * skipped here — they are default-value overrides already validated on Window:
 * exclusive, keep_title_visible, maximize_disabled, minimize_disabled, title,
 * transient, visible, wrap_controls. Only 5 are genuinely its own, all bound in
 * scene/gui/dialogs.cpp's AcceptDialog::_bind_methods with plain ADD_PROPERTY
 * (no PROPERTY_HINT_RANGE, no PROPERTY_USAGE_NONE), so each is a bare bool or
 * String check.
 *
 * AcceptDialog is itself a base for ConfirmationDialog (and FileDialog beneath
 * that), which chain here rather than re-declaring these.
 */

import '../window/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('AcceptDialog', {
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "dialog_text", PROPERTY_HINT_MULTILINE_TEXT), "set_text", "get_text");
  dialog_text: v.quotedString('dialog_text'),
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "ok_button_text"), "set_ok_button_text", "get_ok_button_text");
  ok_button_text: v.quotedString('ok_button_text'),
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dialog_autowrap"), "set_autowrap", "has_autowrap");
  dialog_autowrap: v.boolean('dialog_autowrap'),
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dialog_close_on_escape"), "set_close_on_escape", "get_close_on_escape");
  dialog_close_on_escape: v.boolean('dialog_close_on_escape'),
  // scene/gui/dialogs.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dialog_hide_on_ok"), "set_hide_on_ok", "get_hide_on_ok");
  dialog_hide_on_ok: v.boolean('dialog_hide_on_ok'),
});
