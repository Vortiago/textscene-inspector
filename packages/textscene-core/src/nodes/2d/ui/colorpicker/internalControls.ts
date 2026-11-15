/**
 * The Controls a ColorPicker's constructor builds (`scene/gui/color_picker.cpp:2070-2307`), as the spec
 * of one internal Control, `internal_margin`, with what `NOTIFICATION_THEME_CHANGED` (`:116-176`),
 * `_update_controls` (`:267-322`), `_update_color` (`:714-748`) and `_update_text_value` (`:1319-1336`)
 * set on them for the node's properties. The one solve lays them out and the walker draws them.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { HIDDEN_LINE, builtWidgetProperties, shownIf } from '../../../../r3f/controls/native/sceneLines';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { Rgba } from '../../../../godot/math/math';
import { ZERO_RECT, type Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import { SIZE_EXPAND_FILL, SizeFlags } from '../../../../godot/scene/control';
import { ContainerAlignment } from '../../../../godot/scene/container';
import { ColorPickerColorMode } from '../../../../godot/scene/gui';
import type { NativeControlComponent } from '../../../../r3f/controls/ControlComponentRegistry';
import {
  builtButtonIconRequests,
  internalControlsOf,
  type InternalControlSpec,
  type InternalControlsFn,
  type InternalLayoutFn,
  type PushedThemeItems,
} from '../../../../r3f/controls/native/internalControls';
import { themedIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import { isLaidOutChild, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  themedSlotRequests,
  type ContainerLayoutFn,
  type MinimumSizeFn,
  type SolveContext,
  type TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { requiredThemeItem, themeItemsOfType } from '../../../../r3f/controls/native/themeItems';
import {
  COLOR_PICKER_ADD_PRESET_ICON,
  COLOR_PICKER_BAR_ARROW_ICON,
  COLOR_PICKER_BUTTON_ICON_SIZE,
  COLOR_PICKER_MENU_ICON,
  COLOR_PICKER_PIPETTE_ICON,
  COLOR_PICKER_SHAPE_ICONS,
  COLOR_SCRIPT_ICON,
  FOLDABLE_CONTAINER_ICONS,
} from '../../../../r3f/controls/native/themeIcons';
import { parseColor } from '../../../../utils/colorParser';
import { boxContainerMinimumSize, makeBoxContainerLayout } from '../shared/boxContainerSolver';
import { isSortableControl } from '../shared/fitChildInRect';
import {
  COLOR_MODE_NAMES,
  MODE_BUTTON_COUNT,
  alphaGradient,
  channelGradient,
  colorModeAlphaChannel,
  colorModeChannels,
  colorModeIntensityChannel,
  colorModeAllowsGreater,
  colorModeStep,
  colorNormalized,
  hexFieldText,
  type ChannelGradient,
} from './colorModes';
import { ChannelGradientDraw, type ChannelGradientProperties } from './draws/ChannelGradientDraw';
import { SampleDraw, type SampleDrawProperties } from './draws/SampleDraw';
import { ShapeControlDraw, type ShapeControlDrawProperties } from './shapes/ShapeControlDraw';
import { drawnShapeVariant } from './shapes/pickerShapes';
import { pickerShapeColor, type ShapeControl, type ShapeVariant } from './shapes/shapeDrawing';
import type { ColorPickerProperties } from './types';

/** `SIZE_EXPAND_FILL`, `SIZE_SHRINK_CENTER` and `SIZE_SHRINK_BEGIN` (no flag set), as a scene line writes them. */
const EXPAND_FILL = String(SIZE_EXPAND_FILL);
const SHRINK_CENTER = String(SizeFlags.SHRINK_CENTER);
const SHRINK_BEGIN = '0';

const ICON_CENTRED = { icon_alignment: String(HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER) };
const TEXT_LEFT = { alignment: String(HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT) };
const FLAT_TOGGLE = { flat: 'true', toggle_mode: 'true' };
/** `set_anchors_and_offsets_preset(PRESET_FULL_RECT)`: the Control covers its parent. */
const FULL_RECT = { anchor_right: '1.0', anchor_bottom: '1.0' };

/** The variation every MenuButton of the picker sets (`color_picker.cpp:2096,2149,2253`). */
const FLAT_MENU_BUTTON = 'FlatMenuButton';

/** `_reset_sliders_theme`'s `grabber_offset` (`color_picker.cpp:638,648`), at scale 1. */
const CHANNEL_GRABBER_OFFSET = 8;
/** The `custom_minimum_size` widths `NOTIFICATION_THEME_CHANGED` sets (`color_picker.cpp:122-124,170-172`), at scale 1. */
const ICON_BUTTON_WIDTH = 28;
const HEX_LABEL_WIDTH = 38;
/** `PRESET_COLUMN_COUNT` (`color_picker.h:175`). */
const PRESET_COLUMN_COUNT = 9;

/** The theme icons the picker sets on its Buttons, with the vendored icon each stands in for. */
const BUTTON_ICON_URLS = {
  screen_picker: COLOR_PICKER_PIPETTE_ICON,
  menu_option: COLOR_PICKER_MENU_ICON,
  folded_arrow: FOLDABLE_CONTAINER_ICONS.foldedArrow,
  add_preset: COLOR_PICKER_ADD_PRESET_ICON,
  color_script: COLOR_SCRIPT_ICON,
  ...COLOR_PICKER_SHAPE_ICONS,
} as const;

type ButtonIconName = keyof typeof BUTTON_ICON_URLS;

/** The icons the picker's own `draw` callbacks read, which its theme gives the Control they draw on. */
type DrawnIconName = 'sample_bg' | 'overbright_indicator' | 'picker_cursor' | 'picker_cursor_bg';

/** The drawn icons `draw_texture` draws at their own size. `sample_bg` tiles at the size its texture loads with. */
const SIZED_DRAWN_ICONS: readonly DrawnIconName[] = [
  'overbright_indicator',
  'picker_cursor',
  'picker_cursor_bg',
];

/** Every icon of `BUTTON_ICON_URLS` and `bar_arrow` is 16x16 (`themeIcons.ts`). */
const PICKER_ICON_SIZE: Vector2 = { x: COLOR_PICKER_BUTTON_ICON_SIZE, y: COLOR_PICKER_BUTTON_ICON_SIZE };

/** What every builder reads: the picker, its properties, its colour and the theme scale. */
interface Picker {
  node: SolveNode;
  props: ColorPickerProperties;
  scale: number;
  /** `color`, and `color_normalized`, which every slider and gradient reads (`color_picker.cpp:593-602`). */
  color: Rgba;
  normalized: Rgba;
  mode: number;
  /** The drawn shape, or nothing for `SHAPE_NONE`. */
  shape: ShapeVariant | null;
}

/** A Control the constructor builds: its type, its name, the scene lines it sets and what it holds. */
interface Widget {
  type: string;
  name: string;
  raw?: Record<string, string>;
  /** Typed properties no scene line carries, such as what a `draw` callback reads. */
  properties?: object;
  variation?: string;
  /** The theme icon this Button shows (`set_button_icon`). */
  icon?: ButtonIconName;
  /** The picker's theme icons the Control's `draw` callback reads. */
  drawnIcons?: readonly DrawnIconName[];
  pushed?: PushedThemeItems;
  textureSlots?: SolveNode['textureSlots'];
  draws?: NativeControlComponent;
  children?: readonly Widget[];
}

const widget = (type: string, name: string, more: Omit<Widget, 'type' | 'name'> = {}): Widget => ({
  type,
  name,
  ...more,
});

const quoted = (text: string) => `"${text}"`;

const minimumSize = (w: number, h = 0) => ({ custom_minimum_size: `Vector2(${w}, ${h})` });

/** `btn_shape`, `btn_mode` and `menu_btn`: MenuButtons drawn as flat-variation Buttons (`set_flat(false)`). */
const menuButton = (name: string, icon: ButtonIconName | undefined, raw: Record<string, string> = {}) =>
  widget('MenuButton', name, { variation: FLAT_MENU_BUTTON, icon, raw: { flat: 'false', ...raw } });

/** The width of `btn_pick`, `btn_shape` and `btn_mode`. */
const iconButtonMinimum = ({ scale }: Picker) => minimumSize(ICON_BUTTON_WIDTH * scale);

/** `shape_container` with the Controls of the current shape: `_update_controls` builds only those (`:308-318`). */
function shapeContainer(picker: Picker): Widget {
  const shapeColor = pickerShapeColor(picker.normalized);
  const constants = picker.node.constants;
  const minimum: Record<ShapeControl['minimum'], Record<string, string>> = {
    area: minimumSize(requiredThemeItem(constants, 'sv_width'), requiredThemeItem(constants, 'sv_height')),
    slider: minimumSize(requiredThemeItem(constants, 'h_width')),
    none: {},
  };
  const shapeWidget = (control: ShapeControl): Widget => {
    const properties: ShapeControlDrawProperties | undefined = control.draw && {
      shapeDraw: control.draw,
      shapeColor,
      pickColor: picker.color,
    };
    return widget(control.type, control.name, {
      raw: {
        ...minimum[control.minimum],
        ...(control.isExpanding && { size_flags_horizontal: EXPAND_FILL }),
        ...(control.fillsParent && FULL_RECT),
      },
      properties,
      drawnIcons: control.draw && ['picker_cursor', 'picker_cursor_bg'],
      draws: control.draw && ShapeControlDraw,
      children: control.children?.map(shapeWidget),
    });
  };
  return widget('HBoxContainer', 'shape_container', {
    raw: { alignment: String(ContainerAlignment.ALIGNMENT_CENTER) },
    children: picker.shape?.controls.map(shapeWidget) ?? [],
  });
}

/** `sample_hbc` (`:2081-2101`): `btn_pick`, the `sample` swatch and `btn_shape`, which `SHAPE_NONE` hides (`:321`). */
function sampleRow(picker: Picker): Widget {
  const sample: SampleDrawProperties = { pickColor: picker.color };
  return widget('HBoxContainer', 'sample_hbc', {
    raw: shownIf(picker.props.samplerVisible),
    children: [
      widget('Button', 'btn_pick', {
        icon: 'screen_picker',
        raw: { ...ICON_CENTRED, ...iconButtonMinimum(picker) },
      }),
      widget('TextureRect', 'sample', {
        raw: { size_flags_horizontal: EXPAND_FILL },
        properties: sample,
        drawnIcons: ['sample_bg', 'overbright_indicator'],
        draws: SampleDraw,
      }),
      menuButton('btn_shape', picker.shape?.icon, {
        toggle_mode: 'true',
        ...ICON_CENTRED,
        ...iconButtonMinimum(picker),
        ...shownIf(picker.shape !== null),
      }),
    ],
  });
}

/** `mode_hbc` (`:2129-2154`): a toggle Button for each of the first three modes, then `btn_mode`. */
function modeRow(picker: Picker): Widget {
  const tabs = themeItemsOfType(picker.node, 'TabContainer').styleBoxes;
  // `mode_button_*` bind `tab_unselected` and `tab_selected` of TabContainer (`:2060-2063`).
  const modeButtonBoxes = {
    normal: tabs.tab_unselected!,
    pressed: tabs.tab_selected!,
    hover: tabs.tab_selected!,
    hover_pressed: tabs.tab_selected!,
  };
  const modeButton = (index: number) =>
    widget('Button', `mode_btn_${index}`, {
      raw: {
        text: quoted(COLOR_MODE_NAMES[index]!),
        toggle_mode: 'true',
        button_pressed: String(index === picker.mode),
        size_flags_horizontal: EXPAND_FILL,
      },
      pushed: { styleBoxes: modeButtonBoxes },
    });
  return widget('HBoxContainer', 'mode_hbc', {
    raw: shownIf(picker.props.colorModesVisible),
    children: [
      ...Array.from({ length: MODE_BUTTON_COUNT }, (_, i) => modeButton(i)),
      menuButton('btn_mode', 'menu_option', {
        toggle_mode: 'true',
        ...ICON_CENTRED,
        ...iconButtonMinimum(picker),
      }),
    ],
  });
}

/** The Range a slider and its SpinBox share (`slider->share(val)`, `:458`). */
interface SharedRange {
  minValue: number;
  maxValue: number;
  step: number;
  value: number;
  allowGreater: boolean;
}

/** One row of `slider_gc`, as `create_slider` builds it (`:445-494`). */
interface SliderRow {
  index: number;
  label: string;
  range: SharedRange;
  isShown: boolean;
  /** What the slider's `draw` callback draws: none on `intensity_slider`, which connects none (`:477-481`). */
  gradient: ChannelGradient | null;
  /** The SpinBox's `prefix`: `intensity_value` shows a "+" before a value of 0 or more (`:729`). */
  prefix?: string;
}

/** The rows of `slider_gc` in `SLIDER_MAX` order: the three channels, intensity, then alpha (`color_picker.h:153-159`). */
function sliderRows({ props, color, normalized, mode }: Picker): SliderRow[] {
  const step = colorModeStep(mode);
  const allowGreater = colorModeAllowsGreater(mode);
  const channels = colorModeChannels(mode, normalized).map((channel, index): SliderRow => ({
    index,
    label: channel.label,
    range: { minValue: 0, maxValue: channel.max, step, value: channel.value, allowGreater },
    isShown: true,
    gradient: channelGradient(mode, index as 0 | 1 | 2, normalized),
  }));
  const intensity = colorModeIntensityChannel(color);
  const alpha = colorModeAlphaChannel(mode, color);
  return [
    ...channels,
    {
      index: 3,
      label: intensity.label,
      // `intensity_slider` spans -10 to 10 at step 0.001, and its value box allows greater (`:2183-2187`).
      range: {
        minValue: -10,
        maxValue: intensity.max,
        step: 0.001,
        value: intensity.value,
        allowGreater: true,
      },
      isShown: props.editIntensity !== false,
      gradient: null,
      prefix: intensity.value < 0 ? '' : '+',
    },
    {
      index: 4,
      label: alpha.label,
      range: { minValue: 0, maxValue: alpha.max, step, value: alpha.value, allowGreater: false },
      isShown: props.editAlpha !== false,
      gradient: alphaGradient(normalized),
    },
  ];
}

/** The size of the picker icon `name`: its theme's texture once known, else the vendored 16x16 at `scale`. */
function pickerIconSize(picker: SolveNode, name: string, scale: number): Vector2 {
  return themedIconSize(picker.textureSlots, name, PICKER_ICON_SIZE, scale);
}

/**
 * What `_reset_sliders_theme` and `NOTIFICATION_THEME_CHANGED` push onto a channel or alpha slider
 * (`:145-149`, `:629-653`): `bar_arrow` as both grabbers, `grabber_offset` and `center_grabber`.
 */
function colorizedSliderTheme(picker: Picker): Pick<Widget, 'pushed' | 'textureSlots'> {
  const barArrow = picker.node.icons.bar_arrow;
  const grabbers = <Icon>(icon: Icon) => ({ grabber: icon, grabber_highlight: icon });
  return {
    pushed: {
      constants: {
        grabber_offset: Math.trunc(CHANNEL_GRABBER_OFFSET * picker.scale),
        center_grabber: requiredThemeItem(picker.node.constants, 'center_slider_grabbers'),
      },
      ...(barArrow ? { icons: grabbers(barArrow) } : { defaultIcons: grabbers(COLOR_PICKER_BAR_ARROW_ICON) }),
    },
    textureSlots: { grabber: pickerIconSize(picker.node, 'bar_arrow', picker.scale) },
  };
}

/** One row's Label, HSlider and SpinBox. */
function sliderRowWidgets(picker: Picker, row: SliderRow): Widget[] {
  const shown = shownIf(row.isShown);
  const labelWidth = requiredThemeItem(picker.node.constants, 'label_width');
  const sliderRaw = { size_flags_horizontal: EXPAND_FILL, size_flags_vertical: SHRINK_CENTER, ...shown };
  const slider = widget(
    'HSlider',
    `slider_${row.index}`,
    row.gradient
      ? {
          raw: sliderRaw,
          ...colorizedSliderTheme(picker),
          properties: { ...row.range, channelGradient: row.gradient } satisfies SharedRange &
            ChannelGradientProperties,
          drawnIcons: ['sample_bg'],
          draws: ChannelGradientDraw,
        }
      : { raw: sliderRaw, properties: row.range }
  );
  return [
    widget('Label', `label_${row.index}`, {
      raw: {
        text: quoted(row.label),
        size_flags_vertical: SHRINK_CENTER,
        ...minimumSize(labelWidth),
        ...shown,
      },
    }),
    slider,
    widget('SpinBox', `value_${row.index}`, {
      raw: shown,
      // `create_slider` aligns the value field right (`:468`), which the SpinBox's `alignment` sets.
      properties: {
        ...row.range,
        prefix: row.prefix,
        alignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT,
      },
    }),
  ];
}

/** `slider_gc` (`:2172-2189`): three columns of label, slider and value. */
function sliderGrid(picker: Picker): Widget {
  return widget('GridContainer', 'slider_gc', {
    raw: { columns: '3', size_flags_horizontal: EXPAND_FILL, ...shownIf(picker.props.slidersVisible) },
    children: sliderRows(picker).flatMap((row) => sliderRowWidgets(picker, row)),
  });
}

/** `hex_hbc` (`:2191-2222`): `hex_label`, `text_type` and `c_text`, as `_update_text_value` sets them. */
function hexRow(picker: Picker): Widget {
  const hex = hexFieldText(picker.color, picker.props.editAlpha !== false);
  const textTypeWidth = iconButtonMinimum(picker);
  // A colour no hex code holds shows `color_script`, disabled, in place of "#" (`:1320-1327`).
  const textType = hex.typeText
    ? widget('Button', 'text_type', { raw: { text: quoted(hex.typeText), flat: 'true', ...textTypeWidth } })
    : widget('Button', 'text_type', {
        icon: 'color_script',
        raw: { flat: 'true', disabled: 'true', ...textTypeWidth },
      });
  return widget('HBoxContainer', 'hex_hbc', {
    raw: { alignment: String(ContainerAlignment.ALIGNMENT_BEGIN), ...shownIf(picker.props.hexVisible) },
    children: [
      widget('Label', 'hex_label', {
        raw: { text: quoted(hex.label), ...minimumSize(HEX_LABEL_WIDTH * picker.scale) },
      }),
      textType,
      widget('LineEdit', 'c_text', {
        raw: { size_flags_horizontal: EXPAND_FILL, placeholder_text: quoted('Hex code or named color') },
        properties: { text: hex.text },
      }),
    ],
  });
}

/**
 * `swatches_vbc` (`:2224-2287`). No scene line presses `btn_preset` or `btn_recent_preset`, so each
 * shows `folded_arrow` (`_update_drop_down_arrow`, `:1024-1030`) and both preset rows stay hidden.
 */
function swatches(picker: Picker): Widget {
  return widget('VBoxContainer', 'swatches_vbc', {
    raw: shownIf(picker.props.presetsVisible),
    children: [
      widget('HBoxContainer', 'palette_box', {
        raw: { size_flags_horizontal: EXPAND_FILL },
        children: [
          widget('Button', 'btn_preset', {
            icon: 'folded_arrow',
            raw: {
              text: quoted('Swatches'),
              ...FLAT_TOGGLE,
              ...TEXT_LEFT,
              size_flags_horizontal: EXPAND_FILL,
            },
          }),
          menuButton('menu_btn', 'menu_option'),
        ],
      }),
      widget('Label', 'palette_name', { raw: HIDDEN_LINE }),
      widget('GridContainer', 'preset_container', {
        raw: { columns: String(PRESET_COLUMN_COUNT), size_flags_horizontal: EXPAND_FILL, ...HIDDEN_LINE },
        children: [widget('Button', 'btn_add_preset', { icon: 'add_preset', raw: ICON_CENTRED })],
      }),
      widget('Button', 'btn_recent_preset', {
        icon: 'folded_arrow',
        raw: { text: quoted('Recent Colors'), ...FLAT_TOGGLE, ...TEXT_LEFT },
      }),
      widget('HBoxContainer', 'recent_preset_hbc', {
        raw: { size_flags_vertical: SHRINK_BEGIN, ...HIDDEN_LINE },
      }),
    ],
  });
}

/** `perm_hb` (`:2294-2304`): the screen recording notice, shown only on macOS without the permission. */
const permissionRow = widget('HBoxContainer', 'perm_hb', {
  raw: { alignment: String(ContainerAlignment.ALIGNMENT_CENTER), ...HIDDEN_LINE },
  children: [
    widget('LinkButton', 'perm_link', { raw: { text: quoted('Screen Recording permission missing!') } }),
  ],
});

/** `internal_margin` (`:2071-2075`), with the picker's `margin` on every side (`:161-166`), holding `real_vbox`. */
function internalMargin(picker: Picker): Widget {
  const margin = requiredThemeItem(picker.node.constants, 'margin');
  return widget('MarginContainer', 'internal_margin', {
    pushed: {
      constants: { margin_left: margin, margin_top: margin, margin_right: margin, margin_bottom: margin },
    },
    children: [
      widget('VBoxContainer', 'real_vbox', {
        children: [
          shapeContainer(picker),
          sampleRow(picker),
          modeRow(picker),
          sliderGrid(picker),
          hexRow(picker),
          swatches(picker),
          permissionRow,
        ],
      }),
    ],
  });
}

/** The picker's theme icons `names`, for those its theme chain gives one. */
function themedPickerIcons(picker: SolveNode, names: readonly string[]): SolveNode['icons'] | undefined {
  const themed = names.filter((name) => picker.icons[name]).map((name) => [name, picker.icons[name]!]);
  return themed.length > 0 ? Object.fromEntries(themed) : undefined;
}

function build(picker: Picker, spec: Widget): InternalControlSpec {
  const { icon } = spec;
  return {
    type: spec.type,
    name: spec.name,
    properties: builtWidgetProperties(spec, BUTTON_ICON_URLS),
    children: (spec.children ?? []).map((child) => build(picker, child)),
    variation: spec.variation,
    icons: themedPickerIcons(picker.node, [...(icon ? [icon] : []), ...(spec.drawnIcons ?? [])]),
    textureSize: icon && pickerIconSize(picker.node, icon, picker.scale),
    textureSlots: { ...drawnIconSlots(picker.node, spec.drawnIcons), ...spec.textureSlots },
    pushed: spec.pushed,
    draws: spec.draws,
  };
}

/** The picker's sizes of the icons a `draw` callback draws at their own size (`draw_texture`), where a Theme gives them. */
function drawnIconSlots(picker: SolveNode, names: readonly DrawnIconName[] = []): SolveNode['textureSlots'] {
  return Object.fromEntries(
    names.flatMap((name) => (picker.textureSlots[name] ? [[name, picker.textureSlots[name]]] : []))
  );
}

/** The one internal Control, `internal_margin`, added `INTERNAL_MODE_FRONT` (`:2072`). */
export const colorPickerInternalControls: InternalControlsFn = (node, theme) => {
  const props = node.node.properties as ColorPickerProperties;
  const color = parseColor(props.color);
  const picker: Picker = {
    node,
    props,
    scale: theme.scale,
    color,
    normalized: colorNormalized(color),
    mode: props.colorMode ?? ColorPickerColorMode.MODE_RGB,
    shape: drawnShapeVariant(props.pickerShape),
  };
  return [{ mode: 'front', spec: build(picker, internalMargin(picker)) }];
};

/** The picker's Controls as `_resort` sorts them: `get_child_count` counts the internal ones, so `internal_margin` comes first. */
type StackEntry = { node: SolveNode; minSize: Vector2 };

const stackVertically = makeBoxContainerLayout(true);

function marginEntry(picker: SolveNode, ctx: SolveContext): StackEntry[] {
  const [margin] = internalControlsOf(picker, ctx.theme);
  return margin ? [{ node: margin.node, minSize: ctx.combinedMinimumSize(margin.node) }] : [];
}

function authoredEntries(picker: SolveNode, ctx: SolveContext): StackEntry[] {
  return picker.children
    .filter((child) => isLaidOutChild(picker, child))
    .map((child) => ({ node: child, minSize: ctx.combinedMinimumSize(child) }));
}

/**
 * ColorPicker is a VBoxContainer (`color_picker.h:82`): it stacks `internal_margin`, then each
 * authored child, `separation` apart (`box_container.cpp`).
 */
function stackedRects(picker: SolveNode, authored: readonly StackEntry[], rect: Rect2, ctx: SolveContext) {
  return stackVertically(picker, [...marginEntry(picker, ctx), ...authored], rect, ctx) as ReadonlyMap<
    string,
    Rect2
  >;
}

export const colorPickerInternalLayout: InternalLayoutFn = (picker, internals, rect, ctx) => {
  const rects = stackedRects(picker, authoredEntries(picker, ctx), rect, ctx);
  return new Map(internals.map(({ node }) => [node.path, rects.get(node.path) ?? ZERO_RECT]));
};

export const colorPickerContainerLayout: ContainerLayoutFn = (picker, children, rect, ctx) => {
  const rects = stackedRects(picker, children, rect, ctx);
  return new Map(children.map(({ node }) => [node.path, rects.get(node.path) ?? ZERO_RECT]));
};

/** ColorPicker sets no `get_minimum_size`: a VBoxContainer's minimum stacks `internal_margin` and the authored children. */
export const colorPickerMinimumSize: MinimumSizeFn = (picker, ctx) =>
  boxContainerMinimumSize(
    true,
    requiredThemeItem(picker.constants, 'separation'),
    [...marginEntry(picker, ctx), ...authoredEntries(picker, ctx)]
      .filter(({ node }) => isSortableControl(node))
      .map(({ minSize }) => minSize)
  );

/** One slot for each Button and grabber icon a Theme gives the picker, then the slots of the Buttons it builds without one. */
export const colorPickerTextureSlots: TextureSlotsFn = (_node, themedIcons = {}, builtIcons) => [
  ...themedSlotRequests([...Object.keys(BUTTON_ICON_URLS), 'bar_arrow', ...SIZED_DRAWN_ICONS], themedIcons),
  ...builtButtonIconRequests(['Button'], builtIcons),
];
