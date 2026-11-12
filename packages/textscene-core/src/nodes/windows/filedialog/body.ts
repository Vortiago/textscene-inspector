/**
 * The Control tree a FileDialog's constructor builds above its button row (`scene/gui/file_dialog.cpp:2304-2538`),
 * as synthetic `SolveNode`s in the dialog's scope. The dialog solver lays it out and the dialog painter draws
 * it like any scene Controls. The properties of the dialog decide which Controls are visible and what they
 * show, as `update_customization` and `_update_option_controls` do (`:1203-1214,1913-1975`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { parseNodeWithRegistry } from '../../../core/NodeRegistry';
import {
  DisplayMode,
  FileMode,
  firstFilterLabel,
  isOpenFileMode,
  FILE_DIALOG_ICON_SIZE,
  FILE_DIALOG_LIST_ICONS,
  FILE_DIALOG_SIDE_LIST_MINIMUM_WIDTH,
  FILE_DIALOG_THEME_ICONS,
  FILE_DIALOG_THUMBNAIL_SIZE,
  type FileDialogListIcon,
  type FileDialogThemeIcon,
} from '../../../godot/scene/fileDialog';
import { SizeFlags } from '../../../godot/scene/control';
import type { Vector2 } from '../../../godot/math/vector';
import { FILE_DIALOG_ICON_URLS, FILE_DIALOG_LIST_ICON_URLS } from '../../../r3f/controls/native/themeIcons';
import { ItemListIconMode, ItemListSelectMode } from '../../../godot/scene/gui';
import type { Rgba } from '../../../godot/math/math';
import type { ItemListItem, ItemListProperties } from '../../2d/ui/itemlist/types';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { themedSlotRequests, type TextureSlotsFn } from '../../../r3f/controls/native/solverRegistry';
import { perObject } from '../../../utils/perObject';
import { builtButtonIconRequests, syntheticControl, syntheticPath } from '../acceptdialog/dialogParts';
import type { FileDialogOption, FileDialogProperties } from './parser';

/** `SIZE_EXPAND_FILL` and `SIZE_SHRINK_CENTER`, as a scene line writes them. */
const EXPAND_FILL = String(SizeFlags.EXPAND | SizeFlags.FILL);
const SHRINK_CENTER = String(SizeFlags.SHRINK_CENTER);

/** The type variations the constructor sets (`file_dialog.cpp:2327-2576`), which the default theme defines (`default_theme.cpp:357-395`). */
const FLAT_BUTTON = 'FlatButton';
const FLAT_MENU_BUTTON = 'FlatMenuButton';
const HEADER_SMALL = 'HeaderSmall';

/** What every builder reads: the dialog's properties, its layout direction and the theme scale. */
interface Dialog {
  props: FileDialogProperties;
  rtl: boolean;
  scale: number;
  /** What the file list reads from the dialog's theme (`file_dialog.cpp:820,833,938,1043`). */
  listTheme: FileListTheme;
}

interface FileListTheme {
  /** `thumbnail_size * get_theme_default_base_scale()`. */
  thumbnailSize: number;
  /** The size of the `file` icon, which the list mode draws every icon at. */
  fileIconSize: Vector2;
  folderIconColor: Rgba;
  fileIconColor: Rgba;
}

/** A Control the constructor builds: its type, its name, the scene lines it sets and what it holds. */
interface Widget {
  type: string;
  name: string;
  raw?: Record<string, string>;
  /** Typed properties a scene line cannot carry. */
  properties?: object;
  variation?: string;
  /** The theme icon this button shows (`set_button_icon`, `file_dialog.cpp:1559`). */
  icon?: FileDialogThemeIcon;
  /** The theme icons this Control draws by name, not through a Button (`FileList`'s rows). */
  icons?: readonly FileDialogListIcon[];
  /** The characters selected in this LineEdit (`select`, `file_dialog.cpp:56-63`). */
  selection?: { begin: number; end: number };
  children?: readonly Widget[];
}

const widget = (type: string, name: string, more: Omit<Widget, 'type' | 'name'> = {}): Widget => ({
  type,
  name,
  ...more,
});

const HIDDEN = { visible: 'false' };

/** A scene line set for a Control that `update_customization` shows only while its flag is on. */
const shownIf = (isShown: boolean): Record<string, string> => (isShown ? {} : HIDDEN);

const iconButton = (name: string, icon: FileDialogThemeIcon, raw: Record<string, string> = {}) =>
  widget('Button', name, { variation: FLAT_BUTTON, icon, raw });

const toggleButton = (
  name: string,
  icon: FileDialogThemeIcon,
  isPressed: boolean,
  raw: Record<string, string> = {}
) => iconButton(name, icon, { toggle_mode: 'true', button_pressed: String(isPressed), ...raw });

const separator = (name: string, isShown: boolean) => widget('VSeparator', name, { raw: shownIf(isShown) });

function topToolbar({ props, rtl }: Dialog): Widget {
  const canCreateFolders = props.folder_creation_enabled && !isOpenFileMode(props.file_mode);
  return widget('HBoxContainer', 'TopToolbar', {
    children: [
      iconButton('DirPrev', rtl ? 'forward_folder' : 'back_folder'),
      iconButton(
        'DirNext',
        rtl ? 'back_folder' : 'forward_folder',
        props.is_next_folder_disabled ? { disabled: 'true' } : {}
      ),
      iconButton('DirUp', 'parent_folder'),
      widget('Label', 'PathLabel', { raw: { text: '"Path:"' } }),
      widget('HBoxContainer', 'DrivesContainer'),
      widget('LineEdit', 'DirectoryEdit', {
        raw: { size_flags_horizontal: EXPAND_FILL },
        properties: { text: props.path_text },
      }),
      widget('HBoxContainer', 'ShortcutsContainer'),
      iconButton('RefreshButton', 'reload'),
      iconButton('FavoriteButton', 'favorite', shownIf(props.favorites_enabled)),
      widget('HBoxContainer', 'MakeDirContainer', {
        raw: shownIf(canCreateFolders),
        children: [separator('MakeDirSeparator', true), iconButton('MakeDirButton', 'create_folder')],
      }),
    ],
  });
}

const sideList = (name: string, { scale }: Dialog) =>
  widget('ItemList', name, {
    raw: {
      size_flags_vertical: EXPAND_FILL,
      custom_minimum_size: `Vector2(${FILE_DIALOG_SIDE_LIST_MINIMUM_WIDTH * scale}, 0)`,
    },
  });

function favoritesColumn(dialog: Dialog): Widget {
  return widget('VBoxContainer', 'FavoriteVBox', {
    raw: { size_flags_vertical: EXPAND_FILL, ...shownIf(dialog.props.favorites_enabled) },
    children: [
      widget('HBoxContainer', 'FavoriteHBox', {
        children: [
          widget('Label', 'FavoritesLabel', {
            variation: HEADER_SMALL,
            raw: { text: '"Favorites:"', size_flags_horizontal: EXPAND_FILL },
          }),
          iconButton('FavoriteUp', 'favorite_up', { disabled: 'true' }),
          iconButton('FavoriteDown', 'favorite_down', { disabled: 'true' }),
        ],
      }),
      sideList('FavoriteList', dialog),
    ],
  });
}

function recentColumn(dialog: Dialog): Widget {
  return widget('VBoxContainer', 'RecentVBox', {
    raw: { size_flags_vertical: EXPAND_FILL, ...shownIf(dialog.props.recent_list_enabled) },
    children: [
      widget('Label', 'RecentLabel', { variation: HEADER_SMALL, raw: { text: '"Recent:"' } }),
      sideList('RecentList', dialog),
    ],
  });
}

function lowerToolbar({ props }: Dialog): Widget {
  const hasHidden = props.hidden_files_toggle_enabled;
  const hasFilter = props.file_filter_toggle_enabled;
  const hasSort = props.file_sort_options_enabled;
  const hasLayout = props.layout_toggle_enabled;
  const isThumbnails = props.display_mode === DisplayMode.THUMBNAILS;
  return widget('HBoxContainer', 'LowerToolbar', {
    children: [
      widget('Label', 'FilesLabel', {
        variation: HEADER_SMALL,
        raw: { text: '"Directories & Files:"', size_flags_horizontal: EXPAND_FILL },
      }),
      toggleButton('ShowHidden', 'toggle_hidden', false, shownIf(hasHidden)),
      separator('ShowHiddenSeparator', hasHidden && (hasLayout || hasFilter || hasSort)),
      widget('HBoxContainer', 'LayoutContainer', {
        raw: shownIf(hasLayout),
        children: [
          toggleButton('ThumbnailMode', 'thumbnail_mode', isThumbnails),
          toggleButton('ListMode', 'list_mode', !isThumbnails),
          separator('LayoutSeparator', hasFilter || hasSort),
        ],
      }),
      toggleButton('ShowFilenameFilter', 'toggle_filename_filter', false, shownIf(hasFilter)),
      widget('MenuButton', 'FileSort', {
        variation: FLAT_MENU_BUTTON,
        icon: 'sort',
        raw: shownIf(hasSort),
      }),
    ],
  });
}

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** The ItemList properties `update_file_list` sets for a display mode (`file_dialog.cpp:815-834`). */
function fileListLayout({ props, listTheme }: Dialog): Partial<ItemListProperties> {
  const selectMode =
    props.file_mode === FileMode.OPEN_FILES
      ? ItemListSelectMode.SELECT_MULTI
      : ItemListSelectMode.SELECT_SINGLE;
  if (props.display_mode === DisplayMode.THUMBNAILS) {
    return {
      selectMode,
      iconMode: ItemListIconMode.ICON_MODE_TOP,
      maxColumns: 0,
      maxTextLines: 2,
      // Integer division, as `thumbnail_size * 3 / 2` is.
      fixedColumnWidth: Math.trunc((listTheme.thumbnailSize * 3) / 2),
      fixedIconSize: { x: listTheme.thumbnailSize, y: listTheme.thumbnailSize },
    };
  }
  return {
    selectMode,
    iconMode: ItemListIconMode.ICON_MODE_LEFT,
    maxColumns: 1,
    maxTextLines: 1,
    fixedColumnWidth: 0,
    fixedIconSize: listTheme.fileIconSize,
  };
}

/** One row of the file list: its theme icon, its icon colour and whether it is the selected row (`file_dialog.cpp:933-940,1016-1046`). */
function fileListItems({ props, listTheme }: Dialog): ItemListItem[] {
  const isThumbnails = props.display_mode === DisplayMode.THUMBNAILS;
  return props.file_rows.map((row, index) => {
    const icon: FileDialogListIcon = row.isDirectory
      ? isThumbnails
        ? 'folder_thumbnail'
        : 'folder'
      : isThumbnails
        ? 'file_thumbnail'
        : 'file';
    return {
      text: row.name,
      themedIcon: { name: icon, vendoredUrl: FILE_DIALOG_LIST_ICON_URLS[icon] },
      iconModulate: row.isDirectory ? listTheme.folderIconColor : listTheme.fileIconColor,
      disabled: row.isDisabled,
      isSelected: index === props.selected_row,
      isCurrent: index === props.selected_row,
    };
  });
}

function fileList(dialog: Dialog): Widget {
  const items = fileListItems(dialog);
  return widget('ItemList', 'FileList', {
    raw: { size_flags_vertical: EXPAND_FILL },
    properties: { ...fileListLayout(dialog), items, itemCount: items.length },
    icons: FILE_DIALOG_LIST_ICONS,
  });
}

function fileColumn(dialog: Dialog): Widget {
  return widget('VBoxContainer', 'FileVBox', {
    children: [
      lowerToolbar(dialog),
      fileList(dialog),
      widget('HBoxContainer', 'FileBox', {
        children: [
          widget('Label', 'FileLabel', { raw: { text: '"File:"' } }),
          widget('LineEdit', 'FilenameEdit', {
            raw: { size_flags_horizontal: EXPAND_FILL, size_flags_stretch_ratio: '4.0' },
            properties: { text: dialog.props.current_file },
            selection: dialog.props.file_selection ?? undefined,
          }),
          widget('OptionButton', 'Filter', {
            raw: { size_flags_horizontal: EXPAND_FILL, size_flags_stretch_ratio: '3.0', clip_text: 'true' },
            properties: { items: [{ text: firstFilterLabel(dialog.props.filters), id: 0 }], selected: 0 },
          }),
        ],
      }),
    ],
  });
}

function mainSplit(dialog: Dialog): Widget {
  return widget('HSplitContainer', 'MainSplit', {
    raw: { size_flags_vertical: EXPAND_FILL },
    children: [
      widget('VSplitContainer', 'FavoriteSplit', {
        children: [favoritesColumn(dialog), recentColumn(dialog)],
      }),
      fileColumn(dialog),
    ],
  });
}

/** The options of one kind, each with its index in the whole list, which names its Controls. */
function optionsOf(options: readonly FileDialogOption[], hasValues: boolean) {
  return options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.values.length > 0 === hasValues);
}

/** An option without values is a CheckBox, in a flow row (`file_dialog.cpp:1930-1938`). */
function checkboxOptions({ props }: Dialog): Widget {
  return widget('HFlowContainer', 'FlowCheckboxOptions', {
    raw: { size_flags_horizontal: EXPAND_FILL, alignment: '1' },
    children: optionsOf(props.options, false).map(({ option, index }) =>
      widget('CheckBox', `CheckboxOption${index}`, {
        raw: { text: JSON.stringify(option.name), button_pressed: String(option.defaultIndex !== 0) },
      })
    ),
  });
}

/** An option with values is a Label and an OptionButton, in a two-column grid (`file_dialog.cpp:1939-1953`). */
function valueOptions({ props }: Dialog): Widget {
  return widget('GridContainer', 'GridSelectOptions', {
    raw: { size_flags_horizontal: SHRINK_CENTER, columns: '2' },
    children: optionsOf(props.options, true).flatMap(({ option, index }) => [
      widget('Label', `OptionLabel${index}`, { raw: { text: JSON.stringify(option.name) } }),
      widget('OptionButton', `OptionValues${index}`, {
        properties: {
          items: option.values.map((text, id) => ({ text, id })),
          selected: option.defaultIndex,
        },
      }),
    ]),
  });
}

/** `main_vbox` fills the dialog's content rect (`dialogs.cpp:249-259`). */
function mainVBox(dialog: Dialog): Widget {
  return widget('VBoxContainer', 'MainVBox', {
    raw: { anchor_right: '1.0', anchor_bottom: '1.0' },
    children: [topToolbar(dialog), mainSplit(dialog), checkboxOptions(dialog), valueOptions(dialog)],
  });
}

/** The `FileDialog` theme icons `names` as the dialog's theme chain resolves them, leaving out those the theme leaves to the vendored icon. */
function themedIconsOf(dialog: SolveNode, names: readonly string[]): SolveNode['icons'] | undefined {
  const themed = names.filter((name) => dialog.icons[name]).map((name) => [name, dialog.icons[name]!]);
  return themed.length > 0 ? Object.fromEntries(themed) : undefined;
}

/**
 * The size of a toolbar icon: the dialog Theme's texture once its size is known, else the vendored default's
 * `FILE_DIALOG_ICON_SIZE`. A pending icon takes the default room, as CheckBox, OptionButton and the split grabber
 * do, so the layout only moves when the arriving texture is not that size.
 */
function iconSizeOf(dialog: SolveNode, name: FileDialogThemeIcon | FileDialogListIcon): Vector2 {
  return dialog.textureSlots[name] ?? FILE_DIALOG_ICON_SIZE;
}

/** The Button classes the body builds without an icon, so each takes the theme icon `icon` of its class. */
const BUILT_BUTTON_TYPES = ['Button', 'OptionButton', 'CheckBox'];

/** One slot for each toolbar icon a Theme gives the dialog, so `iconSizeOf` reads its size, then the slots of the buttons the body builds. */
export const fileDialogTextureSlots: TextureSlotsFn = (_node, themedIcons = {}, builtIcons) => [
  ...themedSlotRequests([...FILE_DIALOG_THEME_ICONS, ...FILE_DIALOG_LIST_ICONS], themedIcons),
  ...builtButtonIconRequests(BUILT_BUTTON_TYPES, builtIcons),
];

function build(dialog: SolveNode, spec: Widget, parentPath: string): SolveNode {
  const parsed = parseNodeWithRegistry(
    { type: 'node', attributes: { name: spec.name, type: spec.type } },
    spec.raw ?? {}
  );
  if (!parsed) throw new Error(`expected a parser for ${spec.type}, got none`);
  const properties = {
    ...parsed.properties,
    ...spec.properties,
    ...(spec.variation && { themeTypeVariation: spec.variation }),
  };
  return syntheticControl(dialog, {
    type: spec.type,
    name: spec.name,
    properties,
    parentPath,
    children: (spec.children ?? []).map((child) =>
      build(dialog, child, syntheticPath(parentPath, spec.name))
    ),
    variation: spec.variation,
    icons: themedIconsOf(dialog, [...(spec.icon ? [spec.icon] : []), ...(spec.icons ?? [])]),
    textureSize: spec.icon && iconSizeOf(dialog, spec.icon),
    syntheticDraw: {
      themedIcon: spec.icon && { name: spec.icon, vendoredUrl: FILE_DIALOG_ICON_URLS[spec.icon] },
      selection: spec.selection,
    },
  });
}

/** Written only by `fileDialogBody`. A dialog node is replaced when the scene changes it, so each node builds its tree once per theme. */
const bodies = perObject((_dialog: SolveNode) => new Map<NativeTheme, SolveNode>());

/** The tree rooted at `main_vbox`. */
export function fileDialogBody(dialog: SolveNode, theme: NativeTheme): SolveNode {
  const byTheme = bodies(dialog);
  const known = byTheme.get(theme);
  if (known) return known;
  const props = dialog.node.properties as FileDialogProperties;
  const listTheme: FileListTheme = {
    thumbnailSize: (dialog.constants.thumbnail_size ?? FILE_DIALOG_THUMBNAIL_SIZE) * theme.scale,
    fileIconSize: iconSizeOf(dialog, 'file'),
    folderIconColor: dialog.colors.folder_icon_color ?? WHITE,
    fileIconColor: dialog.colors.file_icon_color ?? WHITE,
  };
  const body = build(
    dialog,
    mainVBox({ props, rtl: dialog.rtl, scale: theme.scale, listTheme }),
    dialog.path
  );
  byTheme.set(theme, body);
  return body;
}
