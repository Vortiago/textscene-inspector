/**
 * The file list a FileDialog settles on from a host's folder listing, against the rows, the File field and the OK button
 * Godot 4.6.3 showed for the same lines (`testing/fileListOracle`, `oracle.out.json`).
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { DirectoryListings } from '../../../resources/directoryListing';
import type { DirectoryEntry } from '../../../resources/projectListing';
import oracle from './testing/fileListOracle/oracle.out.json';
import { parseFileDialog, type FileDialogProperties } from './parser';
import { fileDialogFolders, resolveFileDialog } from './resolve';

interface OracleRow {
  text: string;
  dir: boolean;
  disabled: boolean;
  selected: boolean;
}
interface OracleCase {
  rows: OracleRow[];
  file: string;
  ok_disabled: boolean;
  ok_text: string;
  path_text: string;
}
const godot = oracle as unknown as Record<string, OracleCase>;

const dir = (name: string): DirectoryEntry => ({ name, isDirectory: true });
const file = (name: string): DirectoryEntry => ({ name, isDirectory: false });

/** The tree of `testing/fileListOracle`, in an order no sort would produce. */
const TREE: Record<string, DirectoryEntry[]> = {
  'res://': [
    file('project.godot'),
    dir('d10'),
    file('.secret.png'),
    file('c.txt'),
    dir('beta'),
    file('d2.png'),
    dir('.hidden-dir'),
    file('notes.tscn'),
    dir('Gamma folder'),
    file('B.png'),
    file('_under.png'),
    dir('Alpha'),
    file('oracle.gd'),
    file('oracle.out.json'),
    file('D1.png'),
    dir('d2'),
    file('a.png'),
    file('main.tscn'),
    dir('_underscore-dir'),
    file('archive.zip'),
    file('file-10.png'),
    dir('d1'),
    file('file-2.png'),
    file('d10.png'),
    file('A very long file name that the list trims with an ellipsis.png'),
  ],
  'res://Alpha': [file('inner.png')],
  'res://beta': [file('inner.png')],
  'res://d1': [file('x.txt')],
  'res://d2': [file('x.txt')],
  'res://d10': [file('x.txt')],
  'res://Gamma folder': [file('inner.txt')],
  'res://_underscore-dir': [file('x.txt')],
  'res://.hidden-dir': [file('inner.png')],
};

const LISTINGS: DirectoryListings = Object.fromEntries(
  Object.entries(TREE).map(([folder, entries]) => [folder, { kind: 'listed' as const, entries }])
);
const withMissing = (...folders: string[]): DirectoryListings => ({
  ...LISTINGS,
  ...Object.fromEntries(folders.map((folder) => [folder, { kind: 'missing' as const }])),
});

const PNG = 'PackedStringArray("*.png ; PNG Image")';

/** The lines each oracle case sets. */
const CASES: Record<string, Record<string, string>> = {
  default: {},
  open_png: { file_mode: '0', filters: PNG },
  open_files_png: { file_mode: '1', filters: PNG },
  open_dir: { file_mode: '2' },
  open_any: { file_mode: '3' },
  save: { file_mode: '4' },
  two_filters: {
    file_mode: '0',
    filters: 'PackedStringArray("*.png ; PNG Image", "*.txt, *.zip ; Other")',
  },
  hidden: { file_mode: '0', show_hidden_files: 'true' },
  list_mode: { file_mode: '0', display_mode: '1' },
  filename_filter: { file_mode: '0', filename_filter: '"png"' },
  current_file: { file_mode: '0', current_file: '"B.png"' },
  current_file_missing: { file_mode: '0', current_file: '"nope.png"' },
  current_file_save: { file_mode: '4', current_file: '"B.png"' },
  root_subfolder: { file_mode: '0', root_subfolder: '"Alpha"' },
  current_dir: { file_mode: '0', current_dir: '"beta"' },
  missing_root_subfolder: { file_mode: '0', root_subfolder: '"nope"' },
  missing_current_dir: { file_mode: '0', current_dir: '"nope"' },
  current_file_folder_first: { file_mode: '0', current_file: '"x.png"' },
  wildcard_filter: { file_mode: '0', filters: 'PackedStringArray("file-?.png ; Single")' },
  subfolder_then_missing_dir: { file_mode: '0', root_subfolder: '"Alpha"', current_dir: '"nope"' },
  subfolder_then_relative_dir: { file_mode: '0', root_subfolder: '"d1"', current_dir: '"beta"' },
  subfolder_missing_then_dir: { file_mode: '0', root_subfolder: '"nope"', current_dir: '"beta"' },
  current_path_missing_dir: { file_mode: '0', current_path: '"res://nope/x.png"' },
  current_path_dir: { file_mode: '0', current_path: '"res://beta/inner.png"' },
  nested_root_subfolder: { file_mode: '0', root_subfolder: '"beta"', current_dir: '"res://beta"' },
};

const MISSING_FOLDERS = ['res://nope'];

function dialog(lines: Record<string, string>): TscnNode {
  const heading = { type: 'node', attributes: { name: 'Dialog', type: 'FileDialog' } };
  return {
    name: 'Dialog',
    type: 'FileDialog',
    children: [],
    properties: parseFileDialog(heading, lines),
    rawProperties: lines,
    rawPropertiesOrderReliable: true,
  };
}

const settled = (lines: Record<string, string>): FileDialogProperties =>
  resolveFileDialog(dialog(lines), withMissing(...MISSING_FOLDERS)).properties as FileDialogProperties;

const rowText = (props: FileDialogProperties) =>
  props.file_rows.map((row, index) => ({
    text: row.name,
    dir: row.isDirectory,
    disabled: row.isDisabled,
    selected: props.selected_row === index,
  }));

describe('resolveFileDialog against Godot 4.6.3', () => {
  it.each(Object.keys(CASES).filter((name) => name !== 'filename_filter'))('settles case %s', (name) => {
    const props = settled(CASES[name]!);
    const expected = godot[name]!;
    expect(rowText(props)).toEqual(
      expected.rows.map(({ text, dir: isDir, disabled, selected }) => ({
        text,
        dir: isDir,
        disabled,
        selected,
      }))
    );
    expect([props.current_file, props.ok_button_disabled, props.ok_button_text, props.path_text]).toEqual([
      expected.file,
      expected.ok_disabled,
      expected.ok_text,
      expected.path_text,
    ]);
  });

  // `show_filename_filter` is false at load and clears the filter (`file_dialog.cpp:1222-1226`): all rows stay.
  it('ignores filename_filter, which Godot clears while its box is hidden', () => {
    const props = settled(CASES.filename_filter!);
    expect(props.file_rows.map((row) => row.name)).toEqual(
      godot.filename_filter!.rows.map((row) => row.text)
    );
  });
});

describe('resolveFileDialog without an answer', () => {
  it('lists nothing and keeps the folders a scene names when the host cannot list', () => {
    const node = dialog({ file_mode: '0', current_dir: '"beta"' });
    const { properties } = resolveFileDialog(node, {});
    expect((properties as FileDialogProperties).file_rows).toEqual([]);
    expect((properties as FileDialogProperties).path_text).toBe('res://beta');
  });

  it('keeps the Open button disabled and the File field while nothing is listed', () => {
    const { properties } = resolveFileDialog(dialog({ file_mode: '0', current_file: '"B.png"' }), {});
    expect([
      (properties as FileDialogProperties).ok_button_disabled,
      (properties as FileDialogProperties).current_file,
    ]).toEqual([true, 'B.png']);
  });

  it('lists nothing for the user:// and filesystem accesses', () => {
    expect(settled({ access: '1' }).file_rows).toEqual([]);
    expect(settled({ access: '2' }).file_rows).toEqual([]);
  });
});

describe('fileDialogFolders', () => {
  it('asks for the root and nothing more for a plain dialog', () => {
    expect(fileDialogFolders(dialog({}), {})).toEqual(['res://']);
  });

  it('asks for a folder a line names, which it takes as the one the list shows until it is answered', () => {
    expect(fileDialogFolders(dialog({ current_dir: '"nope"' }), {})).toEqual(['res://nope']);
  });

  it('asks for the root as well once Godot would refuse the folder', () => {
    expect(fileDialogFolders(dialog({ current_dir: '"nope"' }), withMissing('res://nope'))).toEqual([
      'res://nope',
      'res://',
    ]);
  });

  it('asks for the folders of both lines, since a root_subfolder refuses a folder outside it', () => {
    expect(fileDialogFolders(dialog({ root_subfolder: '"Alpha"', current_dir: '"nope"' }), {})).toEqual([
      'res://Alpha',
      'res://nope',
      'res://',
    ]);
  });

  it('asks for nothing under the user:// access', () => {
    expect(fileDialogFolders(dialog({ access: '1' }), {})).toEqual([]);
  });
});
