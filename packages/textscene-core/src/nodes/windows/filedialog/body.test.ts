/**
 * A FileDialog's body and window size against the Controls Godot 4.6.3 lays out for the same properties
 * (`testing/fileDialogGeometry/oracle.out.json`, window space, default theme scale).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import { solveNode } from '../../../r3f/controls/native/testing/solveNode';
import '../../../parser/TscnParser';
import '../../../r3f/controls/index';
import { dialogGeometry } from '../acceptdialog/dialogLayout';
import { wrappedWindowSize } from '../window/wrapControls';
import oracle from './testing/fileDialogGeometry/oracle.out.json';
import { fileDialogTextureSlots } from './body';
import { parseFileDialog } from './parser';

const THEME = nativeTheme(1);
const PNG = 'PackedStringArray("*.png ; PNG Image")';

/** The scene lines of each oracle case (`testing/fileDialogGeometry/oracle.gd`). */
const CASES: Record<string, Record<string, string>> = {
  open: { file_mode: '0', filters: PNG },
  open_files: { file_mode: '1', filters: PNG },
  open_dir: { file_mode: '2', filters: PNG },
  open_any: { file_mode: '3', filters: PNG },
  save: { file_mode: '4', filters: PNG },
  no_filters: { file_mode: '0' },
  two_filters: {
    file_mode: '0',
    filters: 'PackedStringArray("*.png ; PNG Image", "*.jpg, *.jpeg ; JPEG Image")',
  },
  unnamed_filter: { file_mode: '0', filters: 'PackedStringArray("*.png")' },
  no_favorites: { file_mode: '0', filters: PNG, favorites_enabled: 'false' },
  no_recent: { file_mode: '0', filters: PNG, recent_list_enabled: 'false' },
  no_favorites_no_recent: {
    file_mode: '0',
    filters: PNG,
    favorites_enabled: 'false',
    recent_list_enabled: 'false',
  },
  no_hidden_toggle: { file_mode: '0', filters: PNG, hidden_files_toggle_enabled: 'false' },
  no_filter_toggle: { file_mode: '0', filters: PNG, file_filter_toggle_enabled: 'false' },
  no_sort: { file_mode: '0', filters: PNG, file_sort_options_enabled: 'false' },
  no_layout: { file_mode: '0', filters: PNG, layout_toggle_enabled: 'false' },
  no_filter_no_sort: {
    file_mode: '0',
    filters: PNG,
    file_filter_toggle_enabled: 'false',
    file_sort_options_enabled: 'false',
  },
  no_toggles: {
    file_mode: '0',
    filters: PNG,
    hidden_files_toggle_enabled: 'false',
    file_filter_toggle_enabled: 'false',
    file_sort_options_enabled: 'false',
    layout_toggle_enabled: 'false',
  },
  save_no_folder_creation: { file_mode: '4', filters: PNG, folder_creation_enabled: 'false' },
  list_layout: { file_mode: '0', filters: PNG, display_mode: '1' },
  userdata: { file_mode: '0', filters: PNG, access: '1' },
  custom_title: { file_mode: '0', filters: PNG, title: '"Pick one"' },
  keep_title: { file_mode: '0', filters: PNG, mode_overrides_title: 'false' },
  custom_ok: { file_mode: '0', filters: PNG, ok_button_text: '"Choose"' },
  small: { file_mode: '0', filters: PNG, size: 'Vector2i(300, 200)' },
  large: { file_mode: '0', filters: PNG, size: 'Vector2i(900, 500)' },
  options: {
    file_mode: '0',
    filters: PNG,
    option_count: '2',
    'option_0/name': '"Quality"',
    'option_0/values': 'PackedStringArray("Low", "High")',
    'option_0/default': '1',
    'option_1/name': '"Keep metadata"',
  },
  option_checkbox: { file_mode: '0', filters: PNG, option_count: '1', 'option_0/name': '"Keep metadata"' },
  option_checkbox_on: {
    file_mode: '0',
    filters: PNG,
    option_count: '1',
    'option_0/name': '"Keep metadata"',
    'option_0/default': '1',
  },
  option_values: {
    file_mode: '0',
    filters: PNG,
    option_count: '1',
    'option_0/name': '"Quality"',
    'option_0/values': 'PackedStringArray("Low", "High")',
  },
  options_many: {
    file_mode: '0',
    filters: PNG,
    option_count: '5',
    'option_0/name': '"Quality"',
    'option_0/values': 'PackedStringArray("Low", "High")',
    'option_1/name': '"Keep metadata"',
    'option_2/name': '"Compression"',
    'option_2/values': 'PackedStringArray("None", "Fast", "Best")',
    'option_3/name': '"Strip"',
    'option_4/name': '"Interlace"',
  },
};

function fileDialog(lines: Record<string, string>): SolveNode {
  const node = {
    name: 'Dialog',
    type: 'FileDialog',
    children: [],
    properties: parseFileDialog(heading('FileDialog', { name: 'Dialog' }), lines),
  };
  return { ...solveNode(), path: 'Dialog', node: node as unknown as TscnNode };
}

interface OracleRow {
  depth: number;
  type: string;
  rect: number[];
  text?: string;
  disabled?: true;
  pressed?: true;
}

/** The rows of `main_vbox` and below: the Controls between the message label and the button row. */
function oracleBody(rows: readonly OracleRow[]): OracleRow[] {
  const start = rows.findIndex((row) => row.type === 'VBoxContainer');
  const end = rows.findIndex((row, i) => i > start && row.depth === 1);
  return rows.slice(start, end);
}

const rectOf = (rect: number[]) => ({ x: rect[0], y: rect[1], w: rect[2], h: rect[3] });

describe.each(Object.keys(CASES))('FileDialog %s', (name) => {
  const expected = oracle[name as keyof typeof oracle] as {
    size: number[];
    title: string;
    nodes: OracleRow[];
  };
  const window = fileDialog(CASES[name]!);
  const size = wrappedWindowSize(window, THEME, measureText);

  it('has the size Godot gives the window', () => {
    expect([size.x, size.y]).toEqual(expected.size);
  });

  it('has the title Godot shows', () => {
    expect((window.node.properties as { title: string }).title).toBe(expected.title);
  });

  it('places every visible Control of the body where Godot does', () => {
    const { body } = dialogGeometry(window, size, createSolveContext(THEME, measureText));
    const placed = body.map(({ control, rect }) => ({ type: control.node.type, rect }));
    const wanted = oracleBody(expected.nodes).map((row) => ({ type: row.type, rect: rectOf(row.rect) }));
    expect(placed).toEqual(wanted);
  });
});

describe('FileDialog toolbar icon sizes', () => {
  const themedIcon = { ref: 'ExtResource("1")', resources: solveNode().resources, isHeldLocally: true };
  const prevWidth = (dialog: SolveNode) => {
    const ctx = createSolveContext(THEME, measureText);
    const prev = dialogGeometry(dialog, { x: 640, y: 360 }, ctx).body.find(
      ({ control }) => control.node.name === 'DirPrev'
    );
    return prev!.rect.w;
  };
  const base = fileDialog(CASES.open!);

  it('gives the vendored default the 16x16 it has', () => {
    expect(prevWidth(base)).toBe(prevWidth({ ...base, icons: {}, textureSlots: {} }));
  });

  it('lays out the size of the texture a Theme gives the icon', () => {
    const themed = {
      ...base,
      icons: { back_folder: themedIcon },
      textureSlots: { back_folder: { x: 40, y: 40 } },
    };
    expect(prevWidth(themed)).toBeGreaterThan(prevWidth(base));
  });

  it('makes no room for a themed icon whose size is not known yet', () => {
    const loading = { ...base, icons: { back_folder: themedIcon }, textureSlots: { back_folder: null } };
    expect(prevWidth(loading)).toBeLessThan(prevWidth(base));
  });

  it('requests one slot for each icon the Theme gives', () => {
    const requests = fileDialogTextureSlots(base.node, { back_folder: themedIcon });
    expect(requests.map(({ key }) => key)).toEqual(['back_folder']);
  });
});
