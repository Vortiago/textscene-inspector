/**
 * FileDialog strict validators. Declares only FileDialog's own members, the ones
 * doc/classes/FileDialog.xml lists without `overrides=`. The overrides
 * (`dialog_hide_on_ok`, `size`, `title`) and every member from ConfirmationDialog up
 * arrive through the NODE_BASE_TYPES base walk.
 */

import '../confirmationdialog/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../linter/validators/indexedFamily.js';
import { v, accepts, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { packedArrayForms } from '../../../godot/index.js';

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
 * All three spellings the slot converts: `can_convert_strict` lists ARRAY as a source
 * for PACKED_STRING_ARRAY (variant.cpp:467-473), so `filters = ["*.png"]` loads,
 * measured on 4.6.3.
 */
const FILTERS_FORMS = packedArrayForms('PackedStringArray');
// Every element must be a TK_STRING (variant_parser.cpp:1500-1533). A trailing comma
// is legal: this branch's close is ungated (variant_parser.cpp:1524-1525), unlike
// `_parse_construct`'s `first &&` at :575.
const FILTERS_BODY_RE = /^\s*"(?:[^"\\]|\\.)*"\s*(?:,\s*"(?:[^"\\]|\\.)*"\s*)*,?\s*$/;

/**
 * Format-only: `set_filters` (file_dialog.cpp:1259-1266) assigns the vector with no
 * per-element check. Hand-rolled, since `v.ts` has no plain-string packed array.
 */
function packedStringArrayValidator(name: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase()}_FORMAT`;
  const validator = accepts((key, value, line) => {
    const match = FILTERS_FORMS.map((form) => form.exec(value)).find(Boolean);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be an array of quoted strings like PackedStringArray("*.png"), Array[String](["*.png"]) or ["*.png"], got: ${value}`,
        code
      );
    }
    const body = match[1]!.trim();
    if (body === '' || FILTERS_BODY_RE.test(body)) return null;
    return propertyError(key, line, `Property '${name}' contains a non-string element: ${value}`, code);
  }, 'string array (PackedStringArray(…), Array[String]([…]) or […])');
  validator.formatOnly = true;
  return validator;
}

const filtersValidator = packedStringArrayValidator('filters');

/**
 * The three leaves `PropertyListHelper` emits per option (file_dialog.cpp:2201-2203).
 * `name` and `values` are format-only: `set_option_name` (:1977) and
 * `set_option_values` (:1989) assign once `ERR_FAIL_INDEX` passes the option index.
 */
const OPTION_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  name: v.quotedString('name'),
  values: packedStringArrayValidator('values'),
  // `set_option_default` (:2006-2015) clamps against the sibling `values` length
  // (file_dialog.cpp:2012-2014), which this validator cannot see. Both branches
  // floor at 0, so only the floor is checkable.
  default: v.int('default', {
    enforcedMin: { at: 0 },
    enforced: { min: 'file_dialog.cpp:2012' },
  }),
};

/**
 * Dispatches `option_<index>/<leaf>` to its leaf's validator. The negative index
 * bound lives here and the `>= option_count` bound in `linter.ts`, as in PopupMenu:
 * only the second needs a sibling, and a rule claiming both would double-report.
 */
const optionValidator = indexedFamilyValidator({
  prefix: 'option_',
  leaves: OPTION_LEAVES,
  unknownCode: 'INVALID_OPTION_KEY',
  describes: 'option name, values or default',
  // `_set` is `property_helper.property_set_value` (file_dialog.h:386), whose
  // `_get_property` returns nullptr unless the index `is_valid_int()`
  // (property_list_helper.cpp:53-55), so a non-numeric index is a dropped write.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_OPTION_INDEX',
    message: (index) =>
      `Option index ${index} must be non-negative. FileDialog's property helper refuses a negative index (property_list_helper.cpp:58), so this property is never applied`,
  },
});

// `current_dir`, `current_file` and `current_path` are live UI state with PROPERTY_USAGE_NONE
// (file_dialog.cpp:2136-2138), so the storage guard (packed_scene.cpp:865) never saves them: no validator.
// `dialog_text` keeps AcceptDialog's validator. `_validate_property` hides it (file_dialog.cpp:242-247), but
// `AcceptDialog::set_text` (dialogs.cpp:168-179) only assigns: an inert value, not a refusal like box_container.cpp:312.
validatorRegistry.registerAll('FileDialog', {
  // file_dialog.cpp:2113, BOOL, no hint. set_mode_overrides_title (:1354-1356)
  // is a bare assignment.
  mode_overrides_title: v.boolean('mode_overrides_title'),
  file_mode: v.enumInt('file_mode', 0, 4, FILE_MODE, { enforced: 'file_dialog.cpp:1363' }),
  display_mode: v.enumInt('display_mode', 0, 1, DISPLAY_MODE, { enforced: 'file_dialog.cpp:1417' }),
  access: v.enumInt('access', 0, 2, ACCESS, { enforced: 'file_dialog.cpp:1510' }),
  // file_dialog.cpp:2117, STRING, no hint. set_root_subfolder (:1332-1348) assigns
  // before its `dir_exists` guard, and the offline linter has no filesystem to
  // check that guard against.
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

  // The "Customization" bools (file_dialog.cpp:2126-2134) share
  // `set_customization_flag_enabled` (file_dialog.cpp:1495-1502). Its ERR_FAIL_INDEX
  // (:1496) checks the flag that ADD_PROPERTYI bakes in at bind time, never the
  // stored bool, so none carries a bound.
  hidden_files_toggle_enabled: v.boolean('hidden_files_toggle_enabled'),
  file_filter_toggle_enabled: v.boolean('file_filter_toggle_enabled'),
  file_sort_options_enabled: v.boolean('file_sort_options_enabled'),
  folder_creation_enabled: v.boolean('folder_creation_enabled'),
  favorites_enabled: v.boolean('favorites_enabled'),
  recent_list_enabled: v.boolean('recent_list_enabled'),
  layout_toggle_enabled: v.boolean('layout_toggle_enabled'),
  overwrite_warning_enabled: v.boolean('overwrite_warning_enabled'),
  deleting_enabled: v.boolean('deleting_enabled'),

  // `option_<index>/<leaf>`, a PropertyListHelper family with no XML member
  // (file_dialog.cpp:169-170, 2199-2204, 2627; property_list_helper.cpp:138-153). Its
  // PROPERTY_USAGE_DEFAULT (object.h) stores it. The index is glued to the prefix
  // (property_list_helper.cpp:149), hence `#`. The cross-field rule is in linter.ts.
  'option_#/*': optionValidator,
});
