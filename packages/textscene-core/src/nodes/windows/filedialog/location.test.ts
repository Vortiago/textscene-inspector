/**
 * Where a parsed FileDialog stands, against what Godot 4.6.3 showed for the same lines (`pnpm ref:diff` over a
 * project with a `sub` folder): the Path field, the File field and the selection in it.
 */

import { describe, expect, it } from 'vitest';
import { parseFileDialog } from './parser';

const heading = { type: 'node', attributes: { name: 'Dialog', type: 'FileDialog' } };
const location = (lines: Record<string, string> = {}) => parseFileDialog(heading, lines);

describe('FileDialog Path field', () => {
  it.each([
    [{}, 'res://'],
    [{ access: '0' }, 'res://'],
    [{ access: '1' }, 'user://'],
    [{ access: '2' }, ''],
  ])('shows the root of %j as %j', (lines, text) => {
    expect(location(lines).path_text).toBe(text);
  });

  it.each([
    [{ root_subfolder: '"sub"' }],
    [{ root_subfolder: '"res://sub"' }],
    [{ access: '0', root_subfolder: '"sub"' }],
  ])('shows nothing in a root_subfolder %j: the folder is the root', (lines) => {
    expect(location(lines).path_text).toBe('');
  });

  it('resets root_subfolder when a later line changes the access (file_dialog.cpp:1509-1516)', () => {
    const shown = location({ root_subfolder: '"sub"', access: '1' });
    expect([shown.path_text, shown.root_subfolder]).toEqual(['user://', '']);
  });

  it('takes a relative root_subfolder from the folder current_dir set before it (file_dialog.cpp:1332-1342)', () => {
    const shown = location({
      current_dir: '"res://sub"',
      root_subfolder: '"deep"',
      current_file: '"a.png"',
    });
    expect(shown.path_text).toBe('');
    expect(
      location({
        current_dir: '"res://sub"',
        root_subfolder: '"deep"',
        ...{ current_path: '"res://sub/deep/x/a.png"' },
      }).path_text
    ).toBe('x');
  });

  it('keeps root_subfolder when a line repeats the access it has', () => {
    expect(location({ root_subfolder: '"sub"', access: '0' }).root_subfolder).toBe('sub');
  });

  it('shows the folder current_dir names', () => {
    expect(location({ current_dir: '"res://sub"' }).path_text).toBe('res://sub');
    expect(location({ current_dir: '"res://sub/"' }).path_text).toBe('res://sub');
  });

  it('shows a current_dir below the root_subfolder without the root', () => {
    const lines = { root_subfolder: '"sub"', current_dir: '"res://sub/deep"' };
    expect(location(lines).path_text).toBe('deep');
  });

  it('resolves a relative current_dir against the access root', () => {
    expect(location({ current_dir: '"sub"' }).path_text).toBe('res://sub');
  });
});

describe('FileDialog File field', () => {
  it('shows current_file and selects the name before its last dot (file_dialog.cpp:56-63,1308-1315)', () => {
    const shown = location({ current_file: '"x.tar.gz"' });
    expect([shown.current_file, shown.file_selection]).toEqual(['x.tar.gz', { begin: 0, end: 5 }]);
  });

  it('selects nothing in a name without a dot', () => {
    expect(location({ current_file: '"Makefile"' }).file_selection).toBeNull();
  });

  it('splits current_path at the last slash (file_dialog.cpp:1318-1331)', () => {
    const shown = location({ current_path: '"res://sub/y.png"' });
    expect([shown.path_text, shown.current_file]).toEqual(['res://sub', 'y.png']);
  });

  it.each([
    ['res://y.png', 'res://'],
    ['user://y.png', 'user://'],
  ])('keeps the scheme root of current_path %s (the last slash splits %s)', (path, root) => {
    const shown = location({ current_path: `"${path}"` });
    expect([shown.path_text, shown.current_file]).toEqual([root, 'y.png']);
  });

  it('takes a current_path without a slash as the file name only', () => {
    const shown = location({ current_path: '"y.png"' });
    expect([shown.path_text, shown.current_file]).toEqual(['res://', 'y.png']);
  });

  it('ignores an empty current_path', () => {
    expect(location({ current_path: '""' }).current_file).toBe('');
  });

  it('selects nothing before a file line has run', () => {
    expect(location().file_selection).toBeNull();
  });
});

describe('FileDialog next-folder button', () => {
  it.each([[{ current_dir: '"res://sub"' }], [{ current_path: '"res://sub/y.png"' }]])(
    'is disabled once %j has pushed the folder history (file_dialog.cpp:434-443)',
    (lines) => {
      expect(location(lines).is_next_folder_disabled).toBe(true);
    }
  );

  it.each([
    [{}],
    [{ root_subfolder: '"sub"' }],
    [{ current_file: '"y.png"' }],
    [{ current_path: '"y.png"' }],
  ])('stays enabled for %j, which never push a folder', (lines) => {
    expect(location(lines).is_next_folder_disabled).toBe(false);
  });
});

describe('FileDialog current_dir with dot parts (measured in Godot 4.6.3, dir_access_unix.cpp:343-366)', () => {
  it.each([
    ['res://sub/../other', 'res://other'],
    ['res://./sub', 'res://sub'],
    ['res://sub/deep/..', 'res://sub'],
    ['res://sub/.', 'res://sub'],
    ['res://sub//deep', 'res://sub/deep'],
    ['sub/../other', 'res://other'],
  ])('shows %s as %s', (target, shown) => {
    expect(location({ current_dir: JSON.stringify(target) }).path_text).toBe(shown);
  });

  it('refuses a folder above the root and stays where it was', () => {
    expect(location({ current_dir: '"res://.."' }).path_text).toBe('res://');
    expect(location({ current_dir: '"res://sub"', current_path: '"res://../y.png"' }).path_text).toBe(
      'res://sub'
    );
  });

  it('takes a root_subfolder with dot parts as the folder they resolve to', () => {
    const lines = { root_subfolder: '"sub/../other"', current_dir: '"res://other/deep"' };
    expect(location(lines).path_text).toBe('deep');
  });
});
