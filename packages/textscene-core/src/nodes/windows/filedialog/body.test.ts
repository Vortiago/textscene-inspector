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
import { themeResource } from '../../../r3f/controls/native/testing/themeResource';
import { wrappedWindowSize } from '../window/wrapControls';
import oracle from './testing/fileDialogGeometry/oracle.out.json';
import { FILE_DIALOG_THEME_ICONS } from '../../../godot/scene/fileDialog';
import { fileDialogBody, fileDialogTextureSlots } from './body';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { parseFileDialog } from './parser';
import type { ItemListProperties } from '../../2d/ui/itemlist/types';

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
    textureSlots: { 'built:OptionButton': FILTER_ICON, back_folder: TOOLBAR_ICON },
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
});

describe('FileDialog built Button classes', () => {
  const themedIcon = { ref: 'ExtResource("1")', resources: solveNode().resources, isHeldLocally: true };
  const withoutOwnIcon = (node: SolveNode): SolveNode[] => [
    ...(descendsFromClass(node.node.type, 'Button') && !node.syntheticDraw?.themedIcon ? [node] : []),
    ...node.children.flatMap(withoutOwnIcon),
  ];

  it.each(['open', 'save', 'options', 'options_many'])(
    'requests the theme icon of every Button class the %s body builds without an icon',
    (name) => {
      const dialog = fileDialog(CASES[name]!);
      const requested = fileDialogTextureSlots(dialog.node, {}, () => ({ icon: themedIcon })).map(
        ({ key }) => key
      );
      const built = withoutOwnIcon(fileDialogBody(dialog, THEME)).map(({ node }) => `built:${node.type}`);
      expect(requested).toEqual(expect.arrayContaining(built));
    }
  );

  it('gives no built Button without an icon a theme_type_variation, which has no icon slot', () => {
    const variations = withoutOwnIcon(fileDialogBody(fileDialog(CASES.options!), THEME)).map(
      ({ node }) => (node.properties as { themeTypeVariation?: string }).themeTypeVariation
    );
    expect(variations.filter((variation) => variation !== undefined)).toEqual([]);
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

describe('FileDialog file list', () => {
  const ROWS = [
    { name: 'Alpha', isDirectory: true, isDisabled: false },
    { name: 'a.png', isDirectory: false, isDisabled: false },
    { name: 'b.png', isDirectory: false, isDisabled: true },
  ];
  const fileList = (lines: Record<string, string>, extra: Record<string, unknown> = {}) => {
    const dialog = fileDialog(lines);
    const props = { ...(dialog.node.properties as object), file_rows: ROWS, selected_row: 1, ...extra };
    const found = (node: SolveNode): SolveNode | undefined =>
      node.node.name === 'FileList' ? node : node.children.map(found).find(Boolean);
    return found(
      fileDialogBody({ ...dialog, node: { ...dialog.node, properties: props } as TscnNode }, THEME)
    )!;
  };
  const listProps = (list: SolveNode) => list.node.properties as ItemListProperties;

  it('holds one item for each row, with the row named by selected_row selected', () => {
    const items = listProps(fileList(CASES.open!)).items;
    expect(items.map(({ text, isSelected }) => [text, isSelected === true])).toEqual([
      ['Alpha', false],
      ['a.png', true],
      ['b.png', false],
    ]);
    expect(listProps(fileList(CASES.open!)).itemCount).toBe(3);
  });

  it('disables the rows the dialog disables', () => {
    expect(listProps(fileList(CASES.open!)).items.map(({ disabled }) => disabled === true)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('gives a folder and a file their list icons in the list mode', () => {
    const items = listProps(fileList({ ...CASES.open!, display_mode: '1' })).items;
    expect(items.map(({ themedIcon }) => themedIcon?.name)).toEqual(['folder', 'file', 'file']);
  });

  it('gives them their thumbnail icons in the thumbnail mode', () => {
    const items = listProps(fileList(CASES.open!)).items;
    expect(items.map(({ themedIcon }) => themedIcon?.name)).toEqual([
      'folder_thumbnail',
      'file_thumbnail',
      'file_thumbnail',
    ]);
  });

  it('lists in one column of 16 px icons in the list mode (file_dialog.cpp:933-940)', () => {
    const { iconMode, maxColumns, maxTextLines, fixedColumnWidth, fixedIconSize } = listProps(
      fileList({ ...CASES.open!, display_mode: '1' })
    );
    expect({ iconMode, maxColumns, maxTextLines, fixedColumnWidth, fixedIconSize }).toEqual({
      iconMode: 1,
      maxColumns: 1,
      maxTextLines: 1,
      fixedColumnWidth: 0,
      fixedIconSize: { x: 16, y: 16 },
    });
  });

  it('lists in columns of 96 px with 64 px icons in the thumbnail mode (file_dialog.cpp:1016-1040)', () => {
    const { iconMode, maxColumns, maxTextLines, fixedColumnWidth, fixedIconSize } = listProps(
      fileList(CASES.open!)
    );
    expect({ iconMode, maxColumns, maxTextLines, fixedColumnWidth, fixedIconSize }).toEqual({
      iconMode: 0,
      maxColumns: 0,
      maxTextLines: 2,
      fixedColumnWidth: 96,
      fixedIconSize: { x: 64, y: 64 },
    });
  });

  it('tints a folder with folder_icon_color and a file with file_icon_color', () => {
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const green = { r: 0, g: 1, b: 0, a: 1 };
    const dialog = fileDialog(CASES.open!);
    const themed = { ...dialog, colors: { folder_icon_color: red, file_icon_color: green } };
    const props = { ...(dialog.node.properties as object), file_rows: ROWS, selected_row: null };
    const body = fileDialogBody(
      { ...themed, node: { ...dialog.node, properties: props } as TscnNode },
      THEME
    );
    const list = (function find(node: SolveNode): SolveNode | undefined {
      return node.node.name === 'FileList' ? node : node.children.map(find).find(Boolean);
    })(body)!;
    expect(listProps(list).items.map(({ iconModulate }) => iconModulate)).toEqual([red, green, green]);
  });

  it('requests a slot for each list icon the Theme gives', () => {
    const themedIcon = { ref: 'ExtResource("1")', resources: solveNode().resources, isHeldLocally: true };
    const requests = fileDialogTextureSlots(fileDialog(CASES.open!).node, {
      folder: themedIcon,
      file: themedIcon,
    });
    expect(requests.map(({ key }) => key)).toEqual(['folder', 'file']);
  });
});
