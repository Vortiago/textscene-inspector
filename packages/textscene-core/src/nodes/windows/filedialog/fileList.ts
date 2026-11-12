/**
 * The rows a FileDialog's file list holds and the state its selection leaves, as `update_file_list`
 * (`scene/gui/file_dialog.cpp:813-1068`) builds them from a folder's entries: folders then files, each sorted by name, the
 * hidden ones left out, the files cut to the first filter, and one row selected.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FILE_MODE_TEXT, FileMode } from '../../../godot/scene/fileDialog';
import { fileNoCaseCompare } from '../../../godot/string/fileNameOrder';
import { stripEdges } from '../../../godot/string/string.js';
import { wildcardMatchNoCase } from '../../../godot/string/wildcard';
import type { DirectoryEntry } from '../../../resources/projectListing';

export interface FileListRow {
  readonly name: string;
  readonly isDirectory: boolean;
  /** Every file in a folder-picking dialog (`file_dialog.cpp:1045-1047`). */
  readonly isDisabled: boolean;
}

export interface FileListInput {
  readonly entries: readonly DirectoryEntry[];
  /** Each entry as written: `*.png, *.jpg ; Images`. */
  readonly filters: readonly string[];
  readonly showHiddenFiles: boolean;
  readonly fileMode: number;
  readonly currentFile: string;
  readonly isOkDisabled: boolean;
  readonly okText: string;
  /** Whether the scene set `ok_button_text`, which `set_default_ok_text` leaves alone. */
  readonly hasCustomOkText: boolean;
}

export interface FileListState {
  readonly rows: readonly FileListRow[];
  /** The index of the selected row, or null. */
  readonly selectedRow: number | null;
  /** The File field's text once the selection has run. */
  readonly currentFile: string;
  readonly isOkDisabled: boolean;
  readonly okText: string;
}

/** The OK text after a folder is selected in a mode that can pick it (`file_dialog.cpp:648-653`). */
const SELECT_FOLDER_TEXT = 'Select This Folder';

/** `entry` is hidden when its name starts with a dot (`DirAccessUnix::get_next`, `dir_access_unix.cpp:150-187`). */
const isHidden = ({ name }: DirectoryEntry) => name.startsWith('.');

/**
 * The patterns the filter selected at load matches (`file_dialog.cpp:866-889`): the first item of the filter button, which is
 * the only one a scene can select. It is "All Recognized" with several filters, the one filter with one, and "All Files",
 * which matches everything, with none.
 */
function patternsOf(filters: readonly string[]): string[] {
  return filters.flatMap((filter) => (filter.split(';')[0] ?? '').split(',').map(stripEdges));
}

function matchingPattern(patterns: readonly string[], name: string): string | null {
  return patterns.find((pattern) => wildcardMatchNoCase(name, pattern)) ?? null;
}

const byName = (a: DirectoryEntry, b: DirectoryEntry) => fileNoCaseCompare(a.name, b.name);

/** The rows, and for each file row the pattern that matched it. */
function listRows(input: FileListInput): { rows: FileListRow[]; matched: (string | null)[] } {
  const shown = input.showHiddenFiles ? input.entries : input.entries.filter((entry) => !isHidden(entry));
  const patterns = patternsOf(input.filters);
  const folders = shown.filter((entry) => entry.isDirectory).sort(byName);
  const files = shown
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({ entry, pattern: matchingPattern(patterns, entry.name) }))
    .filter(({ pattern }) => patterns.length === 0 || pattern !== null)
    .sort((a, b) => byName(a.entry, b.entry));
  const isDisabled = input.fileMode === FileMode.OPEN_DIR;
  return {
    rows: [
      ...folders.map(({ name }) => ({ name, isDirectory: true, isDisabled: false })),
      ...files.map(({ entry }) => ({ name: entry.name, isDirectory: false, isDisabled })),
    ],
    matched: [...folders.map(() => null), ...files.map(({ pattern }) => pattern)],
  };
}

/** `_is_open_should_be_disabled` for one selected row, or for none (`file_dialog.cpp:549-566`). */
function isOpenDisabled(fileMode: number, selected: FileListRow | null): boolean {
  if (fileMode === FileMode.OPEN_ANY || fileMode === FileMode.SAVE_FILE) return false;
  if (selected === null) return fileMode !== FileMode.OPEN_DIR;
  const picksFiles = fileMode === FileMode.OPEN_FILE || fileMode === FileMode.OPEN_FILES;
  return picksFiles ? selected.isDirectory : !selected.isDirectory;
}

/** `_file_list_selected` for a row the dialog selects itself: it sets the File field and the default OK text (`file_dialog.cpp:640-657`). */
function selectFirst(
  input: FileListInput,
  row: FileListRow
): Pick<FileListState, 'currentFile' | 'okText' | 'isOkDisabled'> {
  const isSave = input.fileMode === FileMode.SAVE_FILE;
  let okText = input.okText;
  if (!input.hasCustomOkText) {
    if (!row.isDirectory) okText = isSave ? FILE_MODE_TEXT[FileMode.SAVE_FILE]!.okText : 'Open';
    else if (input.fileMode === FileMode.OPEN_DIR || input.fileMode === FileMode.OPEN_ANY)
      okText = SELECT_FOLDER_TEXT;
  }
  return {
    currentFile: row.isDirectory ? '' : row.name,
    okText,
    isOkDisabled: isOpenDisabled(input.fileMode, row),
  };
}

/** The last file whose name is the File field's text, or that a filter names exactly (`file_dialog.cpp:1049-1051`). */
function namedRow(
  input: FileListInput,
  rows: readonly FileListRow[],
  matched: readonly (string | null)[]
): number | null {
  let found: number | null = null;
  rows.forEach((row, index) => {
    if (!row.isDirectory && (row.name === input.currentFile || matched[index] === row.name)) found = index;
  });
  return found;
}

/** The list and the state around it once `update_file_list` and its first selection have run. */
export function settleFileList(input: FileListInput): FileListState {
  const { rows, matched } = listRows(input);
  const named = namedRow(input, rows, matched);
  const unchanged = {
    currentFile: input.currentFile,
    okText: input.okText,
    isOkDisabled: input.isOkDisabled,
  };
  if (named !== null) return { rows, selectedRow: named, ...unchanged };
  const picksFirst = input.fileMode !== FileMode.SAVE_FILE && input.fileMode !== FileMode.OPEN_DIR;
  if (!picksFirst || rows.length === 0) return { rows, selectedRow: null, ...unchanged };
  return { rows, selectedRow: 0, ...selectFirst(input, rows[0]!) };
}
