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
  firstFilterLabel,
  isOpenFileMode,
  FILE_DIALOG_THEME_ICONS,
  type FileDialogThemeIcon,
} from '../../../godot/scene/fileDialog';
import { SizeFlags } from '../../../godot/scene/control';
import type { Vector2 } from '../../../godot/math/vector';
import { flatButtonBoxes } from '../../../r3f/controls/native/flatButtonBoxes';
import { FILE_DIALOG_ICON_URLS } from '../../../r3f/controls/native/themeIcons';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { themedSlotRequest, type TextureSlotsFn } from '../../../r3f/controls/native/solverRegistry';
import { perObject } from '../../../utils/perObject';
import { syntheticControl } from '../acceptdialog/dialogParts';
import type { FileDialogOption, FileDialogProperties } from './parser';

/** `SIZE_EXPAND_FILL` and `SIZE_SHRINK_CENTER`, as a scene line writes them. */
const EXPAND_FILL = String(SizeFlags.EXPAND | SizeFlags.FILL);
const SHRINK_CENTER = String(SizeFlags.SHRINK_CENTER);

/** The size of every FileDialog icon (`scene/theme/icons/`, 16x16). */
const FILE_DIALOG_ICON_SIZE: Vector2 = { x: 16, y: 16 };

/** `favorite_list` and `recent_list` floor their width at `128 * get_theme_default_base_scale()` (`file_dialog.cpp:261-262`). */
const SIDE_LIST_MINIMUM_WIDTH = 128;

/** The type variations the constructor sets (`file_dialog.cpp:2327-2576`), which the default theme defines (`default_theme.cpp:357-395`). */
const FLAT_BUTTON = 'FlatButton';
const FLAT_MENU_BUTTON = 'FlatMenuButton';
const HEADER_SMALL = 'HeaderSmall';

/** What every builder reads: the dialog's properties, its layout direction and the theme scale. */
interface Dialog {
  props: FileDialogProperties;
  rtl: boolean;
  scale: number;
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
      custom_minimum_size: `Vector2(${SIDE_LIST_MINIMUM_WIDTH * scale}, 0)`,
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

function fileColumn(dialog: Dialog): Widget {
  return widget('VBoxContainer', 'FileVBox', {
    children: [
      lowerToolbar(dialog),
      widget('ItemList', 'FileList', { raw: { size_flags_vertical: EXPAND_FILL } }),
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

function isFlatButton(variation: string | undefined): boolean {
  return variation === FLAT_BUTTON || variation === FLAT_MENU_BUTTON;
}

/** The path a synthetic Control gets: its parent's, then its own name, as `syntheticControl` joins them. */
const pathOf = (parentPath: string, name: string) => `${parentPath}/@${name}`;

/** The `FileDialog` theme icon `name` as the dialog's theme chain resolves it, or none when the theme leaves it to the vendored icon. */
function themedIconsOf(
  dialog: SolveNode,
  name: FileDialogThemeIcon | undefined
): SolveNode['icons'] | undefined {
  const themed = name && dialog.icons[name];
  return themed ? { [name]: themed } : undefined;
}

/**
 * The size of a toolbar icon: the dialog Theme's texture once its size is known, else the vendored default's
 * `FILE_DIALOG_ICON_SIZE`. A pending icon takes the default room, as CheckBox, OptionButton and the split grabber
 * do, so the layout only moves when the arriving texture is not that size.
 */
function iconSizeOf(dialog: SolveNode, name: FileDialogThemeIcon): Vector2 {
  return dialog.textureSlots[name] ?? FILE_DIALOG_ICON_SIZE;
}

/** One slot for each toolbar icon a Theme gives the dialog, so `iconSizeOf` reads its size. */
export const fileDialogTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) =>
  FILE_DIALOG_THEME_ICONS.flatMap((name) => {
    const themed = themedIcons[name];
    return themed ? [themedSlotRequest(name, themed, FILE_DIALOG_ICON_SIZE)] : [];
  });

function build(dialog: SolveNode, theme: NativeTheme, spec: Widget, parentPath: string): SolveNode {
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
      build(dialog, theme, child, pathOf(parentPath, spec.name))
    ),
    variation: spec.variation,
    variationDefaults: isFlatButton(spec.variation) ? { styleBoxes: flatButtonBoxes(theme) } : undefined,
    icons: themedIconsOf(dialog, spec.icon),
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
  const body = build(dialog, theme, mainVBox({ props, rtl: dialog.rtl, scale: theme.scale }), dialog.path);
  byTheme.set(theme, body);
  return body;
}
