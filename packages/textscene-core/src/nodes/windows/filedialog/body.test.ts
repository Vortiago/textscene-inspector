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
import { builtButtonIconKey } from '../acceptdialog/dialogParts';
import { themeResource } from '../../../r3f/controls/native/testing/themeResource';
import { wrappedWindowSize } from '../window/wrapControls';
import oracle from './testing/fileDialogGeometry/oracle.out.json';
import { FILE_DIALOG_THEME_ICONS } from '../../../godot/scene/fileDialog';
import { fileDialogTextureSlots } from './body';
import { parseFileDialog } from './parser';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };
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

/** The oracle's res:// holds this file, which an unfiltered dialog puts in the File field. The previewer's file list is empty. */
const ORACLE_LISTED_FILE = 'main.tscn';

const rectOf = (rect: number[]) => ({ x: rect[0], y: rect[1], w: rect[2], h: rect[3] });

/** What the oracle records of a Control besides its rect: the text it shows and whether it is disabled or pressed. */
function shownState(control: SolveNode) {
  const props = control.node.properties as {
    text?: string;
    items?: { text: string }[];
    selected?: number;
    disabled?: boolean;
    buttonPressed?: boolean;
  };
  const isOptionButton = control.node.type === 'OptionButton';
  const text = isOptionButton ? (props.items?.[props.selected ?? 0]?.text ?? '') : (props.text ?? '');
  return {
    type: control.node.type,
    text,
    isDisabled: props.disabled === true,
    isPressed: props.buttonPressed === true,
  };
}

describe.each(Object.keys(CASES))('FileDialog %s', (name) => {
  const expected = oracle[name as keyof typeof oracle] as {
    size: number[];
    title: string;
    nodes: OracleRow[];
  };
  const window = fileDialog(CASES[name]!);
  const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);

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

  it('shows the text, the disabled state and the pressed state Godot shows', () => {
    const { body } = dialogGeometry(window, size, createSolveContext(THEME, measureText));
    const wanted = oracleBody(expected.nodes).map(({ type, text = '', disabled, pressed }) => ({
      type,
      text: text === ORACLE_LISTED_FILE ? '' : text,
      isDisabled: disabled === true,
      isPressed: pressed === true,
    }));
    expect(body.map(({ control }) => shownState(control))).toEqual(wanted);
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
    const sixteen = {
      ...base,
      icons: { back_folder: themedIcon },
      textureSlots: { back_folder: { x: 16, y: 16 } },
    };
    expect(prevWidth(base)).toBe(prevWidth(sixteen));
  });

  it('lays out the size of the texture a Theme gives the icon', () => {
    const themed = {
      ...base,
      icons: { back_folder: themedIcon },
      textureSlots: { back_folder: { x: 40, y: 40 } },
    };
    expect(prevWidth(themed)).toBeGreaterThan(prevWidth(base));
  });

  it('gives a themed icon whose size is not known yet the default room', () => {
    const loading = { ...base, icons: { back_folder: themedIcon }, textureSlots: { back_folder: null } };
    expect(prevWidth(loading)).toBe(prevWidth(base));
  });

  it('lays out the whole body as the default when every themed icon is pending', () => {
    const names = FILE_DIALOG_THEME_ICONS;
    const pending = {
      ...base,
      icons: Object.fromEntries(names.map((name) => [name, themedIcon])),
      textureSlots: Object.fromEntries(names.map((name) => [name, null])),
    };
    const rects = (dialog: SolveNode) =>
      dialogGeometry(dialog, { x: 640, y: 360 }, createSolveContext(THEME, measureText)).body.map(
        ({ rect }) => rect
      );
    expect(rects(pending)).toEqual(rects(base));
  });

  it('requests one slot for each icon the Theme gives', () => {
    const requests = fileDialogTextureSlots(base.node, { back_folder: themedIcon });
    expect(requests.map(({ key }) => key)).toEqual(['back_folder']);
  });
});

describe('FileDialog built Button icon sizes', () => {
  const FILTER_ICON = { x: 30, y: 20 };
  const TOOLBAR_ICON = { x: 40, y: 40 };
  const themedIcon = { ref: 'ExtResource("1")', resources: solveNode().resources, isHeldLocally: true };
  const themed = {
    ...fileDialog(CASES.open!),
    themeChain: [themeResource({ icons: { OptionButton: { icon: 'ExtResource("1")' } } })],
    icons: { back_folder: themedIcon },
    textureSlots: { [builtButtonIconKey('OptionButton')]: FILTER_ICON, back_folder: TOOLBAR_ICON },
  };
  const bodyControl = (name: string) => {
    const size = wrappedWindowSize(themed, THEME, measureText, EMBEDDER);
    const { body } = dialogGeometry(themed, size, createSolveContext(THEME, measureText));
    return body.find(({ control }) => control.node.name === name)!.control;
  };

  it('sizes the filter OptionButton by the theme icon of OptionButton', () => {
    expect(bodyControl('Filter').textureSize).toEqual(FILTER_ICON);
  });

  it('keeps the size of the toolbar button own icon', () => {
    expect(bodyControl('DirPrev').textureSize).toEqual(TOOLBAR_ICON);
  });

  it('requests the theme icon of each Button class the body builds without an icon', () => {
    const builtIcons = () => ({ icon: themedIcon });
    const keys = fileDialogTextureSlots(themed.node, {}, builtIcons).map(({ key }) => key);
    expect(keys).toEqual(
      expect.arrayContaining(['Button', 'OptionButton', 'CheckBox'].map((type) => builtButtonIconKey(type)))
    );
  });
});

describe('FileDialog synthetic drawing', () => {
  const bodyControl = (lines: Record<string, string>, name: string) => {
    const dialog = fileDialog(lines);
    const size = wrappedWindowSize(dialog, THEME, measureText, EMBEDDER);
    const { body } = dialogGeometry(dialog, size, createSolveContext(THEME, measureText));
    return body.find(({ control }) => control.node.name === name)!.control;
  };

  it('gives the previous-folder button its theme icon', () => {
    expect(bodyControl(CASES.open!, 'DirPrev').syntheticDraw?.themedIcon?.name).toBe('back_folder');
  });

  it('selects the file name before its dot', () => {
    const field = bodyControl({ ...CASES.open!, current_file: '"a.png"' }, 'FilenameEdit');
    expect(field.syntheticDraw?.selection).toEqual({ begin: 0, end: 1 });
  });
});
