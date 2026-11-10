/**
 * FileDialog registration and parse: a window an embedder draws, whose title and OK text follow its `file_mode`.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { MAX_WALKED_ELEMENTS } from '../../2d/ui/shared/countWalk';
import { parseFileDialog } from './parser';
import './index';
import './index.r3f';

const heading = { type: 'node', attributes: { name: 'Dialog', type: 'FileDialog' } };
const parse = (properties: Record<string, string> = {}) => parseFileDialog(heading, properties);

describe('FileDialog registration', () => {
  it('registers the FileDialog parse', () => {
    expect(nodeRegistry.getRegistration('FileDialog')!.parser).toBe(parseFileDialog);
  });

  it('draws as a viewport its embedder shows', () => {
    expect(nodeComponentRegistry.renderIntentOf('FileDialog')).toBe('draws');
    expect(rendersOwnVisual('FileDialog')).toBe('draws');
  });
});

describe('FileDialog title and OK text per file_mode (file_dialog.cpp:1362-1400)', () => {
  it.each([
    [0, 'Open a File', 'Open'],
    [1, 'Open File(s)', 'Open'],
    [2, 'Open a Directory', 'Select Current Folder'],
    [3, 'Open a File or Directory', 'Open'],
    [4, 'Save a File', 'Save'],
  ])('file_mode %d titles %s and confirms with %s', (file_mode, title, okText) => {
    const dialog = parse({ file_mode: String(file_mode) });
    expect(dialog.title).toBe(title);
    expect(dialog.ok_button_text).toBe(okText);
  });

  it('starts in Save mode', () => {
    expect(parse().file_mode).toBe(4);
    expect(parse().title).toBe('Save a File');
  });

  it('keeps an authored title when mode_overrides_title is off', () => {
    expect(parse({ mode_overrides_title: 'false', title: '"Pick"', file_mode: '0' }).title).toBe('Pick');
  });

  it('lets a later file_mode rewrite the title an earlier line set', () => {
    expect(parse({ title: '"Pick"', file_mode: '0' }).title).toBe('Open a File');
  });

  it('keeps an authored ok_button_text', () => {
    expect(parse({ file_mode: '0', ok_button_text: '"Go"' }).ok_button_text).toBe('Go');
  });

  it('keeps the previous mode for a file_mode the setter refuses', () => {
    expect(parse({ file_mode: '9' }).file_mode).toBe(4);
  });
});

describe('FileDialog OK button over an empty list (file_dialog.cpp:549-557)', () => {
  it.each([
    [0, true],
    [1, true],
    [2, false],
    [3, false],
    [4, false],
  ])('file_mode %d disables OK: %s', (file_mode, isDisabled) => {
    expect(parse({ file_mode: String(file_mode) }).ok_button_disabled).toBe(isDisabled);
  });
});

describe('FileDialog customisation flags (file_dialog.cpp:1203-1214)', () => {
  const flags = [
    'hidden_files_toggle_enabled',
    'file_filter_toggle_enabled',
    'file_sort_options_enabled',
    'folder_creation_enabled',
    'favorites_enabled',
    'recent_list_enabled',
    'layout_toggle_enabled',
  ] as const;

  it.each(flags)('%s is on by default and off when written false', (flag) => {
    expect(parse()[flag]).toBe(true);
    expect(parse({ [flag]: 'false' })[flag]).toBe(false);
  });
});

describe('FileDialog options', () => {
  it('replays option lines in file order and clamps the default to the values', () => {
    const dialog = parse({
      option_count: '2',
      'option_0/name': '"Flag"',
      'option_1/name': '"Mode"',
      'option_1/values': 'PackedStringArray("a", "b")',
      'option_1/default': '5',
    });
    expect(dialog.options).toEqual([
      { name: 'Flag', values: [], defaultIndex: 0 },
      { name: 'Mode', values: ['a', 'b'], defaultIndex: 1 },
    ]);
  });

  it('ignores a negative option index, as Godot 4.6.3 does (property_list_helper.cpp:58-59)', () => {
    const dialog = parse({ option_count: '2', 'option_-1/name': '"Last"' });
    expect(dialog.options.map(({ name }) => name)).toEqual(['', '']);
  });

  it('stops at the walk ceiling for an option_count that would exhaust the heap', () => {
    expect(parse({ option_count: '2000000000' }).options).toHaveLength(MAX_WALKED_ELEMENTS);
  });

  it('ignores an option line outside the count', () => {
    expect(parse({ option_count: '1', 'option_3/name': '"Lost"' }).options).toEqual([
      { name: '', values: [], defaultIndex: 0 },
    ]);
  });
});
