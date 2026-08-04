/**
 * ScriptCreateDialog strict validators for linting.
 *
 * ScriptCreateDialog declares NO serialisable property of its own. Checked:
 *
 * 1. doc/classes/ScriptCreateDialog.xml `<members>` lists exactly 3 entries,
 *    and none appear without an `overrides=` attribute: dialog_hide_on_ok and
 *    ok_button_text carry `overrides="AcceptDialog"`, title carries
 *    `overrides="Window"`. All three are default-value overrides only (the
 *    editor script-creation UI wants "Create" and "Attach Node Script"
 *    instead of AcceptDialog's/Window's own defaults), not new properties.
 *    The one `<methods>` entry, `config(inherits, path, ...)`, configures the
 *    dialog's fields directly rather than through a bound property, so it is
 *    not itself a serialisable key either.
 *
 * 2. script_create_dialog.cpp binds no ADD_PROPERTY at all: `_bind_methods`
 *    (script_create_dialog.cpp:843-847) binds the single `config` method and
 *    the `script_created` signal, nothing else.
 *
 * 3. Neither the .cpp nor the .h overrides `_get_property_list`, `_set`, `_get`
 *    or `_validate_property`, so there is no dynamic key of the kind GraphNode
 *    exposes for its per-child slot state. The absence is verified, not assumed.
 *
 * So this leaf validates only what its base chain already delivers through
 * the NODE_BASE_TYPES base-walk: ConfirmationDialog's own key, AcceptDialog's
 * above that, then Window's.
 */

import '../confirmationdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('ScriptCreateDialog', {});
