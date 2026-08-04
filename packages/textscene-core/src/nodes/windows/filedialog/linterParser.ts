/**
 * FileDialog strict validators for linting.
 *
 * Declare only FileDialog's OWN members: the ones doc/classes/FileDialog.xml
 * lists without an `overrides=` attribute. `dialog_hide_on_ok` (overrides
 * AcceptDialog), `size` and `title` (both override Window) are default-value
 * overrides, not new properties, and are skipped. Everything from
 * ConfirmationDialog up arrives through the NODE_BASE_TYPES base-walk and is
 * not re-declared here.
 *
 * Three declared members never reach a `.tscn` at all: `current_dir`,
 * `current_file` and `current_path` are each `ADD_PROPERTY`'d with the fourth
 * `PropertyInfo` argument `PROPERTY_USAGE_NONE` (file_dialog.cpp:2136-2138),
 * so `SceneState::_parse_node`'s `!(E.usage & PROPERTY_USAGE_STORAGE)` guard
 * (packed_scene.cpp:865) always skips them. They are live UI state (the
 * current browse location), not serialised configuration, so no validator is
 * registered for them.
 *
 * `dialog_text` (an AcceptDialog member FileDialog inherits) is cleared to
 * `PROPERTY_USAGE_NONE` by FileDialog's own `_validate_property`
 * (file_dialog.cpp:242-247: "File dialogs have a custom layout, and dialog
 * nodes can't have both a text and a layout"), so Godot's own saver never
 * emits it for a FileDialog node either. Unlike HBoxContainer's removal of
 * `vertical` (box_container.cpp:312's `ERR_FAIL_COND_MSG(is_fixed, …)`),
 * there is no setter refusal behind this one: `AcceptDialog::set_text`
 * (dialogs.cpp:168-179) is a bare assignment shared by every AcceptDialog
 * subclass, so `registerUnavailable` (which this repo reserves for a real
 * "Godot would reject this" claim) does not fit. `dialog_text` is left to
 * inherit AcceptDialog's validator unchanged: a hand-written value is simply
 * inert (the label it would set is not part of FileDialog's layout), not
 * invalid.
 *
 * The nine "Customization" bools (`hidden_files_toggle_enabled`,
 * `file_filter_toggle_enabled`, `file_sort_options_enabled`,
 * `folder_creation_enabled`, `favorites_enabled`, `recent_list_enabled`,
 * `layout_toggle_enabled`, `overwrite_warning_enabled`, `deleting_enabled`,
 * file_dialog.cpp:2126-2134) all share one setter, `set_customization_flag_enabled`
 * (file_dialog.cpp:1495-1502), which does `ERR_FAIL_INDEX(p_flag, CUSTOMIZATION_MAX)`
 * (:1496). Each property's `Customization` flag is baked in at bind time by
 * `ADD_PROPERTYI`, so that guard only ever checks a compile-time constant
 * against `CUSTOMIZATION_MAX`: it can never fire from a `.tscn` value. The
 * serialised VALUE is the bool, stored unconditionally
 * (`customization_flags[p_flag] = p_enabled;`), so each is a plain
 * `v.boolean` with nothing to ground.
 *
 * `option_count` (`ADD_ARRAY_COUNT`, file_dialog.cpp:2123) is the one bounded
 * scalar: `set_option_count` (:2038-2039) is `ERR_FAIL_COND(p_count < 0)`.
 *
 * FileDialog also carries a dynamic family this XML has no `<members>` entry
 * for at all: `add_option`/`set_option_name`/`set_option_values`/
 * `set_option_default` back a `PropertyListHelper` (`base_property_helper`,
 * `property_helper`, file_dialog.cpp:169-170, 2199-2204, 2627) whose
 * `get_property_list` (property_list_helper.cpp:138-153) emits three leaves
 * per option: `name` (STRING), `values` (PACKED_STRING_ARRAY), `default`
 * (INT), as `option_<index>/<leaf>`, e.g. `option_0/name`
 * (property_list_helper.cpp:149's `vformat("%s%d/%s", prefix, i, info.name)`
 * with `prefix = "option_"`). Every leaf's `PropertyInfo` uses the default
 * usage (object.h's `PROPERTY_USAGE_DEFAULT` carries `PROPERTY_USAGE_STORAGE`),
 * so, exactly like GraphNode's `slot/<index>/<leaf>`, these DO reach a
 * `.tscn`, not just runtime API surface.
 *
 * The index is GLUED to the prefix, with no separating slash, so the family is
 * registered under the `option_#/*` pattern rather than `option_/*`: the
 * registry matches that shape by parsing the index the way
 * `PropertyListHelper::_get_property` does (property_list_helper.cpp:47-55).
 *
 * All three leaves are format-only. `set_option_name` (:1977) and
 * `set_option_values` (:1989) assign straight through once the option INDEX
 * passes `ERR_FAIL_INDEX`, which guards the index rather than the value.
 * `set_option_default` (:2006-2015) does CLAMP its value, but against
 * `values.size() - 1`, a SIBLING leaf's length that a per-property validator
 * cannot see, so there is no static bound to check here.
 *
 * The one part of this family's behaviour that IS coverable without that
 * change is a genuine cross-field consequence of it: see linter.ts.
 */

import '../confirmationdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, accepts, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// file_dialog.cpp:2114, PROPERTY_HINT_ENUM, 5 labels ("Open File,Open Files,
// Open Folder,Open Any,Save"). set_file_mode (:1362-1363) is
// `ERR_FAIL_INDEX((int)p_mode, 5)`: enforced, matching the hint's own labels.
const FILE_MODE = {
  0: 'OPEN_FILE',
  1: 'OPEN_FILES',
  2: 'OPEN_DIR',
  3: 'OPEN_ANY',
  4: 'SAVE_FILE',
};

// file_dialog.cpp:2115, PROPERTY_HINT_ENUM "Thumbnails,List". set_display_mode
// (:1416-1417) is `ERR_FAIL_INDEX((int)p_mode, DISPLAY_MAX)` with DISPLAY_MAX = 2
// (file_dialog.h:127-131): enforced.
const DISPLAY_MODE = { 0: 'THUMBNAILS', 1: 'LIST' };

// file_dialog.cpp:2116, PROPERTY_HINT_ENUM "Resources,User Data,File System".
// set_access (:1509-1510) is `ERR_FAIL_INDEX(p_access, 3)`: enforced.
const ACCESS = { 0: 'RESOURCES', 1: 'USERDATA', 2: 'FILESYSTEM' };

/**
 * `PackedStringArray("a", "b", …)`, each element a TK_STRING token
 * (variant_parser.cpp:1500-1533's PackedStringArray branch requires
 * `token.type == TK_STRING` for every entry, rejecting anything else with
 * "Expected string"). No `v.ts` combinator covers a PackedStringArray of
 * plain strings (only `packedVector2Array` exists), so this is hand-rolled.
 * `set_filters` (file_dialog.cpp:1259-1266) assigns the whole vector straight
 * through with no per-element check, so this rejects only what Godot's own
 * parser could not read either: format-only, no citation needed for a bound.
 */
const FILTERS_WRAPPER_RE = /^\s*PackedStringArray\s*\(([\s\S]*)\)\s*$/;
const FILTERS_BODY_RE = /^\s*"(?:[^"\\]|\\.)*"\s*(?:,\s*"(?:[^"\\]|\\.)*"\s*)*$/;

function packedStringArrayValidator(name: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase()}_FORMAT`;
  const validator = accepts((key, value, line) => {
    const match = FILTERS_WRAPPER_RE.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a PackedStringArray of quoted strings like PackedStringArray("*.png, *.jpg"), got: ${value}`,
        code
      );
    }
    const body = match[1]!.trim();
    if (body === '' || FILTERS_BODY_RE.test(body)) return null;
    return propertyError(key, line, `Property '${name}' contains a non-string element: ${value}`, code);
  }, 'PackedStringArray("filter", …)');
  validator.formatOnly = true;
  return validator;
}

const filtersValidator = packedStringArrayValidator('filters');

/**
 * The three leaves `PropertyListHelper` emits per option
 * (file_dialog.cpp:2201-2203), keyed by leaf name.
 */
const OPTION_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  name: v.quotedString('name'),
  values: packedStringArrayValidator('values'),
  // CLAMPed against the sibling `values` length (file_dialog.cpp:2012-2014),
  // which this validator cannot see, so only the format is checkable.
  default: v.int('default'),
};

/** Dispatches `option_<index>/<leaf>` to the validator for its leaf name. */
const optionValidator: PropertyValidator = accepts((key, value, line) => {
  const leafName = key.slice(key.lastIndexOf('/') + 1);
  const leafValidator = OPTION_LEAVES[leafName];
  if (!leafValidator) {
    return propertyError(
      key,
      line,
      `Unknown FileDialog option property: "${key}". Valid leaves: ${Object.keys(OPTION_LEAVES).join(', ')}`,
      'INVALID_OPTION_KEY'
    );
  }
  return leafValidator(key, value, line);
}, 'option name, values or default');
// Rejects only an unrecognised leaf name, a format concern; every real bound
// lives in OPTION_LEAVES, exposed so the grounding sweep recurses past here.
optionValidator.formatOnly = true;
optionValidator.leaves = Object.values(OPTION_LEAVES);

validatorRegistry.registerAll('FileDialog', {
  // file_dialog.cpp:2113, BOOL, no hint. set_mode_overrides_title (:1354-1356)
  // is a bare assignment.
  mode_overrides_title: v.boolean('mode_overrides_title'),
  file_mode: v.enumInt('file_mode', 0, 4, FILE_MODE, { enforced: 'file_dialog.cpp:1363' }),
  display_mode: v.enumInt('display_mode', 0, 1, DISPLAY_MODE, { enforced: 'file_dialog.cpp:1417' }),
  access: v.enumInt('access', 0, 2, ACCESS, { enforced: 'file_dialog.cpp:1510' }),
  // file_dialog.cpp:2117, STRING, no hint. set_root_subfolder (:1332-1348) does
  // `ERR_FAIL_COND_MSG(!dir_access->dir_exists(p_root), …)`, but only AFTER
  // unconditionally assigning `root_subfolder = p_root`, and the guard is a
  // real-filesystem existence check the offline linter has no directory tree
  // to evaluate against (the same class of check left unmodelled for dangling
  // resource paths elsewhere in this repo), so this stays a plain quoted string.
  root_subfolder: v.quotedString('root_subfolder'),
  filters: filtersValidator,
  // file_dialog.cpp:2119, STRING, no hint. set_filename_filter (:1268-1276)
  // is a bare assignment.
  filename_filter: v.quotedString('filename_filter'),
  // file_dialog.cpp:2120, BOOL, no hint. set_show_hidden_files (:2213-2218)
  // is a bare assignment.
  show_hidden_files: v.boolean('show_hidden_files'),
  // file_dialog.cpp:2121, BOOL, no hint. set_use_native_dialog (:2261-2263)
  // assigns unconditionally before any native-dialog side effect.
  use_native_dialog: v.boolean('use_native_dialog'),
  // file_dialog.cpp:2123 (ADD_ARRAY_COUNT), INT, PROPERTY_HINT_NONE
  // (class_db.cpp:1492 passes no hint). set_option_count (:2038-2039) is
  // `ERR_FAIL_COND(p_count < 0)`: enforced floor.
  option_count: v.strictNonNegativeInt('option_count', { enforced: 'file_dialog.cpp:2039' }),

  // "Customization" group: every one an ADD_PROPERTYI(..., "set_customization_flag_enabled",
  // "is_customization_flag_enabled", CUSTOMIZATION_*) bool. See header comment:
  // the setter's ERR_FAIL_INDEX guards the compile-time-constant flag index,
  // never the serialised bool value, so none of these carry a bound.
  hidden_files_toggle_enabled: v.boolean('hidden_files_toggle_enabled'),
  file_filter_toggle_enabled: v.boolean('file_filter_toggle_enabled'),
  file_sort_options_enabled: v.boolean('file_sort_options_enabled'),
  folder_creation_enabled: v.boolean('folder_creation_enabled'),
  favorites_enabled: v.boolean('favorites_enabled'),
  recent_list_enabled: v.boolean('recent_list_enabled'),
  layout_toggle_enabled: v.boolean('layout_toggle_enabled'),
  overwrite_warning_enabled: v.boolean('overwrite_warning_enabled'),
  deleting_enabled: v.boolean('deleting_enabled'),

  // The dynamic option array. Godot glues the index onto the prefix
  // (property_list_helper.cpp:149), so this is the `#` wildcard shape.
  'option_#/*': optionValidator,
});
