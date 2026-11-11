/**
 * The lenient parse of a FileDialog: the ConfirmationDialog parse plus the properties that change what its
 * constructor-built tree draws (`scene/gui/file_dialog.cpp:2113-2134,2281`). The properties replay in file
 * order, as the loader sets them, because a later `file_mode` rewrites the title the file set before it.
 */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { parsePackedStringArray, unquoteString } from '../../../parser/utils';
import {
  finishLocation,
  setAccess,
  setCurrentDir,
  setCurrentFile,
  setCurrentPath,
  setRootSubfolder,
  startLocation,
  type FileDialogLocation,
} from './location';
import { stringToInt } from '../../../godot/string/string.js';
import { indexedKeyRegex } from '../../../godot/classdb/indexedKey.js';
import { boolOr, intOr } from '../../../parser/valueParsers';
import { MAX_WALKED_ELEMENTS } from '../../2d/ui/shared/countWalk';
import { viewportParseContext } from '../../viewport/shared/parser';
import {
  DEFAULT_FILE_MODE,
  FILE_MODE_TEXT,
  FILE_DIALOG_ACCESS_NAMES,
  FILE_DIALOG_DISPLAY_MODE_NAMES,
  isOpenFileMode,
} from '../../../godot/scene/fileDialog';
import { parseConfirmationDialog, type ConfirmationDialogProperties } from '../confirmationdialog/parser';

/** One entry of the options list: a CheckBox without `values`, a Label and an OptionButton with them. */
export interface FileDialogOption {
  name: string;
  values: readonly string[];
  /** The clamped `default`: the selected value, or 0 or 1 for a CheckBox's unchecked or checked state. */
  defaultIndex: number;
}

export interface FileDialogProperties extends ConfirmationDialogProperties, FileDialogLocation {
  file_mode: number;
  display_mode: number;
  /** Each entry as written: `*.png ; PNG Image`. */
  filters: readonly string[];
  options: readonly FileDialogOption[];
  hidden_files_toggle_enabled: boolean;
  file_filter_toggle_enabled: boolean;
  file_sort_options_enabled: boolean;
  folder_creation_enabled: boolean;
  favorites_enabled: boolean;
  recent_list_enabled: boolean;
  layout_toggle_enabled: boolean;
}

/** `PropertyListHelper` reads the index with `is_valid_int`, a sign included (`property_list_helper.cpp:50-58`). */
const OPTION_KEY = indexedKeyRegex('^option_(#)/(name|values|default)$', 'is_valid_int');

/** A negative index never reaches the setter, so `option_-1/name` is not set (`property_list_helper.cpp:58-59`, measured in Godot 4.6.3). */
function optionIndex(raw: string, count: number): number | undefined {
  const index = stringToInt(raw);
  return index >= 0 && index < count ? index : undefined;
}

/** `set_option_values` and `set_option_default` clamp the default to the values, or to 0..1 with none (`file_dialog.cpp:1989-2020`). */
function clampedDefault(index: number, values: readonly string[]): number {
  const last = values.length === 0 ? 1 : values.length - 1;
  return Math.min(Math.max(index, 0), last);
}

/** The options after each `option_*` line has run in file order. */
function replayOptions(properties: Record<string, string>, context: string): FileDialogOption[] {
  let options: FileDialogOption[] = [];
  for (const [key, raw] of Object.entries(properties)) {
    if (key === 'option_count') {
      // Capped like every dense walk a count drives: a legal `option_count = 2000000000` would exhaust the heap.
      const count = Math.min(Math.max(intOr(raw, 0, `${context}.option_count`), 0), MAX_WALKED_ELEMENTS);
      const empty = (): FileDialogOption => ({ name: '', values: [], defaultIndex: 0 });
      options = Array.from({ length: count }, (_, i) => options[i] ?? empty());
      continue;
    }
    const match = OPTION_KEY.exec(key);
    const index = match ? optionIndex(match[1]!, options.length) : undefined;
    if (!match || index === undefined) continue;
    const option = options[index]!;
    if (match[2] === 'name') options[index] = { ...option, name: unquoteString(raw) };
    else if (match[2] === 'values') {
      const values = parsePackedStringArray(raw) ?? [];
      options[index] = { ...option, values, defaultIndex: clampedDefault(option.defaultIndex, values) };
    } else {
      const defaultIndex = clampedDefault(intOr(raw, 0, `${context}.${key}`), option.values);
      options[index] = { ...option, defaultIndex };
    }
  }
  return options;
}

/** The mode, the title and the default OK text the file's lines leave, in file order (`set_file_mode`, `file_dialog.cpp:1362-1415`). */
function replayModeTexts(properties: Record<string, string>, constructorTitle: string, context: string) {
  let mode: number = DEFAULT_FILE_MODE;
  let title = constructorTitle;
  let overridesTitle = true;
  for (const [key, raw] of Object.entries(properties)) {
    if (key === 'mode_overrides_title') overridesTitle = boolOr(raw, true, `${context}.${key}`);
    else if (key === 'title') title = unquoteString(raw);
    else if (key === 'file_mode') {
      const requested = intOr(raw, mode, `${context}.${key}`);
      if (!Object.hasOwn(FILE_MODE_TEXT, requested)) continue;
      mode = requested;
      if (overridesTitle) title = FILE_MODE_TEXT[mode]!.title;
    }
  }
  return { mode, title };
}

/** The lines that place the dialog, run through the setters in file order. */
function replayLocation(properties: Record<string, string>, context: string): FileDialogLocation {
  const state = startLocation();
  for (const [key, raw] of Object.entries(properties)) {
    if (key === 'access') {
      setAccess(state, enumOr(raw, FILE_DIALOG_ACCESS_NAMES, state.access, `${context}.access`));
    } else if (key === 'root_subfolder') setRootSubfolder(state, unquoteString(raw));
    else if (key === 'current_dir') setCurrentDir(state, unquoteString(raw));
    else if (key === 'current_file') setCurrentFile(state, unquoteString(raw));
    else if (key === 'current_path') setCurrentPath(state, unquoteString(raw));
  }
  return finishLocation(state);
}

/** An enum line the setter refuses when out of range keeps the constructor's value (`ERR_FAIL_INDEX`). */
function enumOr(
  raw: string | undefined,
  names: Readonly<Record<number, string>>,
  fallback: number,
  context: string
) {
  const value = intOr(raw, fallback, context);
  return Object.hasOwn(names, value) ? value : fallback;
}

export function parseFileDialog(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<FileDialogProperties>
): FileDialogProperties {
  const dialog = parseConfirmationDialog(heading, properties, override);
  const context = viewportParseContext(heading, dialog.name);
  const { mode, title } = replayModeTexts(properties, dialog.title, context);
  const flag = (raw: string | undefined, key: string) => boolOr(raw, true, `${context}.${key}`);
  return {
    ...dialog,
    title,
    // An empty `ok_button_text` shows the default the mode last set (`set_default_ok_text`, `dialogs.cpp:491`).
    ok_button_text:
      properties.ok_button_text === undefined || unquoteString(properties.ok_button_text) === ''
        ? FILE_MODE_TEXT[mode]!.okText
        : dialog.ok_button_text,
    file_mode: mode,
    // Nothing is selected in a list that is always empty, so an open mode that picks files has no valid choice.
    ok_button_disabled: isOpenFileMode(mode),
    display_mode: enumOr(
      properties.display_mode,
      FILE_DIALOG_DISPLAY_MODE_NAMES,
      0,
      `${context}.display_mode`
    ),
    ...replayLocation(properties, context),
    filters: properties.filters === undefined ? [] : (parsePackedStringArray(properties.filters) ?? []),
    options: replayOptions(properties, context),
    hidden_files_toggle_enabled: flag(properties.hidden_files_toggle_enabled, 'hidden_files_toggle_enabled'),
    file_filter_toggle_enabled: flag(properties.file_filter_toggle_enabled, 'file_filter_toggle_enabled'),
    file_sort_options_enabled: flag(properties.file_sort_options_enabled, 'file_sort_options_enabled'),
    folder_creation_enabled: flag(properties.folder_creation_enabled, 'folder_creation_enabled'),
    favorites_enabled: flag(properties.favorites_enabled, 'favorites_enabled'),
    recent_list_enabled: flag(properties.recent_list_enabled, 'recent_list_enabled'),
    layout_toggle_enabled: flag(properties.layout_toggle_enabled, 'layout_toggle_enabled'),
  };
}
