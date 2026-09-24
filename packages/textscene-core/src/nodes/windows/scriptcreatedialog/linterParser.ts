/**
 * ScriptCreateDialog strict validators: it declares no serialisable property of its
 * own, so ConfirmationDialog, AcceptDialog and Window supply every key through the
 * NODE_BASE_TYPES base walk.
 */

// doc/classes/ScriptCreateDialog.xml lists 3 members, all overrides: dialog_hide_on_ok and
// ok_button_text of AcceptDialog, title of Window.
import '../confirmationdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// `_bind_methods` (script_create_dialog.cpp:843-847) binds no ADD_PROPERTY, only `config(inherits,
// path, ...)`, which sets the dialog's fields directly, and `script_created`. No
// `_get_property_list`, `_set`, `_get` or `_validate_property` override exists, so there is no
// dynamic key.
validatorRegistry.registerAll('ScriptCreateDialog', {});
