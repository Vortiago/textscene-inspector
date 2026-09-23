/**
 * ScriptCreateDialog strict validators: it declares no serialisable property of its
 * own, so ConfirmationDialog, AcceptDialog and Window supply every key through the
 * NODE_BASE_TYPES base walk.
 */

import '../confirmationdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// doc/classes/ScriptCreateDialog.xml lists 3 members, all overrides: dialog_hide_on_ok
// and ok_button_text of AcceptDialog, title of Window. The `config(inherits, path, ...)`
// method sets the dialog's fields directly, with no bound property.

// script_create_dialog.cpp binds no ADD_PROPERTY: `_bind_methods`
// (script_create_dialog.cpp:843-847) binds only `config` and `script_created`. No
// `_get_property_list`, `_set`, `_get` or `_validate_property` override exists, so
// there is no dynamic key.
validatorRegistry.registerAll('ScriptCreateDialog', {});
