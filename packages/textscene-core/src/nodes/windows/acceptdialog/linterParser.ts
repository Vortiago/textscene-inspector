/**
 * AcceptDialog strict validators. Declare only its own members, the ones
 * doc/classes/AcceptDialog.xml lists without `overrides=`: the base-walk delivers
 * Window's, and ConfirmationDialog and FileDialog inherit these. Each is a plain
 * ADD_PROPERTY in scene/gui/dialogs.cpp, so a bare bool or String check.
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
