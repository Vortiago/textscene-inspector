/**
 * `<ColorPicker>` — the native (WebGL canvas) painter for ColorPicker.
 * ColorPicker builds its whole widget as INTERNAL children in its C++
 * constructor (`scene/gui/color_picker.cpp:2069-2260`); none of that
 * structure is a `.tscn` property, so this ONE painter draws the composite
 * directly from `nativeSolver.ts`'s `colorPickerRows` rather than a subtree
 * the solve tree could walk.
 *
 * Row order (`real_vbox`'s own child order): shape, sample, mode, sliders,
 * hex, swatches — `nativeSolver.ts`'s own doc for which rows always
 * participate in the stack vs. drop out (and their `separation` gap) per
 * visibility flag.
 *
 * ICON GAP: `themeIcons.ts` is out of this packet's files, so `btn_pick`/
 * `btn_shape`/`btn_mode`/`menu_btn`/`text_type`'s own icons are not drawn —
 * their box (where they have a real one) and text still are.
 * `btn_shape`/`btn_mode`/`menu_btn` all use the `FlatMenuButton` type
 * variation, whose "normal"/"hover"/"disabled" styleboxes are
 * `StyleBoxEmpty` (`default_theme.cpp:360,372-375`), and `mode_btns[0..2]`'s
 * own `mode_button_normal/pressed/hover/hover_pressed` overrides are never
 * registered under "ColorPicker" in `default_theme.cpp` either, so they
 * resolve to the SAME empty fallback — none of these five buttons ever
 * draws a background box in an unfocused, unhovered static frame, `color_mode`
 * included (no button visibly differs by which mode is current). Only
 * `btn_pick` (a plain `Button`, `default_theme.cpp:138-141`) has a real one.
 *
 * SLIDER CHROME: only the 16px gradient band every `slider_draw` override
 * paints on TOP of the stock `HSlider` is drawn — the `HSlider`'s own
 * background/grabber-area/grabber icon (`shared/sliderSolver.ts`'s own
 * recipe) is not modelled here, documented on the comparison sheet.
 *
 * Tint: every draw call on a CanvasItem is subject to its own accumulated
 * modulate at the rendering-server level, so `tint.own` is folded into every
 * vertex/quad/text colour below, sRGB-space, before this painter's single
 * decode (the shader injection for the gradient meshes, `useGodotLinearColor`
 * for the flat `ControlQuad`s, `<TextRun>`'s own internal decode for text) —
 * the same ordering `StyleBoxQuad.tsx` and `ColorRect`'s own `Component.tsx`
 * already establish.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { canvasItemFacing } from '../../../../r3f/canvasItemFacing';
import { materialProgramInputs, type ProgramInjection } from '../../../../r3f/materialProgramInputs';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { parseColor } from '../../../../utils/colorParser';
import { AlphaCheckerboardQuad } from '../shared/AlphaCheckerboardQuad';
import {
  COLOR_PICKER_BAR_ARROW_ICON,
  COLOR_PICKER_BUTTON_ICON_SIZE,
  COLOR_PICKER_CURSOR_BG_ICON,
  COLOR_PICKER_CURSOR_ICON,
  COLOR_PICKER_CURSOR_SIZE,
  COLOR_PICKER_MENU_ICON,
  COLOR_PICKER_OVERBRIGHT_ICON,
  COLOR_PICKER_PIPETTE_ICON,
  COLOR_PICKER_SHAPE_RECT_ICON,
  FOLDABLE_CONTAINER_ICONS,
  SLIDER_GRABBER_ICONS,
} from '../../../../r3f/controls/native/themeIcons';
import { sliderTrackRect, sliderGrabberAreaRect, sliderGrabberRect } from '../shared/sliderSolver';
import { spinBoxLayout, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import { SPIN_BOX_ICONS } from '../spinbox/icons';
import { isColorOverbright } from '../shared/colorOverbright';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapedTextSizeWidthPx, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import {
  COLOR_MODE_NAMES,
  COLOR_PICKER_SAMPLE_HEIGHT_FRACTION,
  COLOR_PICKER_THEME_FONT_KEY,
  colorPickerChannelGrabberRect,
  colorPickerIntensityRatio,
  colorPickerLabelColumnWidth,
  colorPickerModeButtonStyleBox,
  colorPickerRows,
  colorPickerScale,
  colorPickerSliderBoxRect,
  colorPickerSliderRowCount,
  colorPickerValueColumnWidth,
  COLOR_PICKER_SLIDER_GRABBER_OFFSET,
  SHAPE_HSV_RECTANGLE,
  extractHsv,
  hexRowColumns,
  hsvToRgb,
  hueIndicatorY,
  invertRgb,
  modeRowButtonRects,
  sampleRowColumns,
  sliderGridRowRects,
  svAndHueRects,
  svSquareCursorPosition,
  swatchesRowRects,
  type TextWidthMeasurer,
} from './nativeSolver';
import { hueStripGeometry, horizontalStripGeometry, linearizeStops, svSquareBaseLayer, svSquareHueLayer, type QuadGeometry } from './svGradient';
import {
  MODE_HSV,
  MODE_LINEAR,
  MODE_OKHSL,
  MODE_RGB,
  alphaChannelGradientStops,
  colorModeAlphaChannel,
  colorModeChannels,
  colorModeIntensityChannel,
  colorNormalized,
  colorPickerSliderLabels,
  formatSliderValue,
  hexFieldText,
  hsvChannelGradientStops,
  hsvHueChannelBase,
  hsvHueChannelOverlayAlpha,
  okhslHueChannelStops,
  okhslLightnessGradientStops,
  okhslSaturationGradientStops,
  rgbChannelGradientStops,
  type ColorModeChannel,
} from './colorModes';
import type { ColorPickerProperties } from './types';

/** `default_theme.cpp`'s `control_font_color` — the shared default text colour for Label/Button (`:100`). None of `btn_preset`/`btn_recent_preset`/`text_type`/`hex_label` override it; `mode_btns`' own PRESSED state does (`MODE_BUTTON_PRESSED_FONT_COLOR` below). */
const CONTROL_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_pressed_color` = `Color(1, 1, 1)` (`default_theme.cpp:105,156`) — `Button`'s own `font_pressed_color`, which the CURRENT `mode_btns[i]` (toggled on) reads instead of the plain `font_color` above. */
const MODE_BUTTON_PRESSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

function buildGeometry(g: QuadGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3));
  geometry.setIndex(g.indices);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.colors), 4));
  return geometry;
}

/**
 * `Color::srgb_to_linear` (`core/math/color.h:192-198`) as GLSL, applied to
 * the INTERPOLATED vertex colour rather than the attribute that feeds it —
 * `StyleBoxQuad.tsx`'s own `decodeVertexColorsFromSRGB` establishes why
 * (interpolating between two different sRGB colours in linear space moves
 * the ramp's midpoint), duplicated here rather than imported since that
 * function is private to a slice this packet does not own.
 */
function decodeVertexColorsFromSRGB(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    /* glsl */ `
    vec3 godotSrgbToLinear = mix(
      pow((vColor.rgb + 0.055) / 1.055, vec3(2.4)),
      vColor.rgb / 12.92,
      step(vColor.rgb, vec3(0.04045))
    );
    diffuseColor *= vec4(godotSrgbToLinear, vColor.a);
    `
  );
}

const SV_GRADIENT_INJECTION: ProgramInjection = {
  cacheKey: 'godot-colorpicker-srgb-vertex-colors',
  onBeforeCompile: decodeVertexColorsFromSRGB,
};

interface GradientMeshProps {
  geometry: THREE.BufferGeometry;
  renderOrder: number;
  clippingPlanes: THREE.Plane[];
  /** `true` when `geometry`'s own vertex colours are ALREADY linear (`svGradient.ts`'s `linearizeStops`) — skips the usual sRGB-decode injection so the GPU's own linear lerp is the final value, reproducing `GRADIENT_COLOR_SPACE_LINEAR_SRGB` (`Component.tsx`'s module doc). */
  linear?: boolean;
}

/** One vertex-coloured, single-pass quad — the SV square's two layers, the hue strip and every channel-slider band all share this recipe. sRGB-decoded by default; `linear` skips that for a caller whose own vertex colours are already linear. */
function GradientMesh({ geometry, renderOrder, clippingPlanes, linear }: GradientMeshProps) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  const program = materialProgramInputs({
    props: {
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      clippingPlanes,
      injection: linear ? undefined : SV_GRADIENT_INJECTION,
    },
    merge: [canvasItemFacing()],
  });
  return (
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

function tintVertexColors(colors: number[], tint: { r: number; g: number; b: number; a: number }): number[] {
  const out = new Array<number>(colors.length);
  for (let i = 0; i < colors.length; i += 4) {
    out[i] = colors[i]! * tint.r;
    out[i + 1] = colors[i + 1]! * tint.g;
    out[i + 2] = colors[i + 2]! * tint.b;
    out[i + 3] = colors[i + 3]! * tint.a;
  }
  return out;
}

interface LabelledTextProps {
  rect: Rect2;
  layout: TextLayoutResult | null;
  fontSizePx: number;
  tint: ControlColor;
  clippingPlanes: THREE.Plane[];
  renderOrder: number;
  /** Right-aligns within `rect` (the SpinBox's own `LineEdit`, `line_edit.cpp`'s default alignment for a numeric value) instead of the left (every plain `Label`). */
  alignRight?: boolean;
  /** Centres within `rect` — `Button`'s own default `alignment` (`button.h:54`), which `mode_btns`/`text_type` never override (contrast `btn_preset`/`btn_recent_preset`'s explicit LEFT, `color_picker.cpp:2248,2283`). Takes precedence over `alignRight`. */
  center?: boolean;
  /** `LineEdit::_notification(NOTIFICATION_DRAW)`'s own `x_ofs` floor: text sits `contentMargin` in from whichever edge it's aligned to, never flush against the box — 0 for a plain Label/Button (no box under the text at all). */
  inset?: number;
}

/** One row of shaped text, vertically centred in `rect` — every label/value/hex run below shares this placement. */
function LabelledText({ rect, layout, fontSizePx, tint, clippingPlanes, renderOrder, alignRight, center, inset = 0 }: LabelledTextProps) {
  if (!layout) return null;
  const width = shapedTextSizeWidthPx(layout.widthPx);
  const x = center ? Math.max(0, (rect.w - width) / 2) : alignRight ? Math.max(inset, rect.w - width - inset) : inset;
  const y = Math.max(0, (rect.h - layout.heightPx) / 2);
  return (
    <CanvasItemGroup position={[rect.x + x, -(rect.y + y), 0]}>
      <TextRun layout={layout} fontSizePx={fontSizePx} tint={tint} clippingPlanes={clippingPlanes} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

interface CenteredIconProps {
  rect: Rect2;
  size: number;
  texture: THREE.Texture | null;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/** One icon, centred inside `rect` — every button icon below (`btn_pick`/`btn_shape`/`btn_mode`/`menu_btn`) shares this placement. */
function CenteredIcon({ rect, size, texture, tint, renderOrder }: CenteredIconProps) {
  if (!texture) return null;
  const x = (rect.w - size) / 2;
  const y = (rect.h - size) / 2;
  return (
    <CanvasItemGroup position={[rect.x + x, -(rect.y + y), 0]}>
      <ControlQuad width={size} height={size} color={tint.color} opacity={tint.opacity} map={texture} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

export function ColorPicker({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<ColorPickerProperties>(solveNode);
  const fill = useMemo(() => parseColor(props.color), [props.color]);
  const hsv = useMemo(() => extractHsv(fill), [fill]);
  const normalized = useMemo(() => colorNormalized(fill), [fill]);
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const scale = colorPickerScale(theme);

  const fontSizePx = theme.fontSize;
  // Read INSIDE the render body, not a `useMemo` (`Label`'s own `Component.tsx` for why).
  const fontMetrics = resolveNodeFontMetrics(solveNode, COLOR_PICKER_THEME_FONT_KEY);
  const layoutCache = useMemo(() => new Map<string, TextLayoutResult>(), []);
  const shape = (text: string): TextLayoutResult => {
    let layout = layoutCache.get(text);
    if (!layout) {
      layout = shapeButtonLabel(text, fontSizePx, fontMetrics);
      layoutCache.set(text, layout);
    }
    return layout;
  };
  const measure: TextWidthMeasurer = (text) => {
    const l = shape(text);
    return { x: shapedTextSizeWidthPx(l.widthPx), y: l.heightPx };
  };

  const contentWidth = Math.max(0, rect.w - 2 * theme.contentMargin);
  const rows = useMemo(
    () => colorPickerRows(contentWidth, theme, props, measure),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentWidth, theme, props.pickerShape, props.samplerVisible, props.colorModesVisible, props.slidersVisible, props.hexVisible, props.presetsVisible, props.editAlpha, props.editIntensity, fontSizePx, fontMetrics]
  );

  const fontColor = useMemo(() => multiplyModulate(tint.own, CONTROL_FONT_COLOR), [tint.own]);
  const pressedFontColor = useMemo(() => multiplyModulate(tint.own, MODE_BUTTON_PRESSED_FONT_COLOR), [tint.own]);
  // `LineEdit::_notification(NOTIFICATION_DRAW)`'s own `x_ofs` floor — the
  // SAME box every value/hex `LineEdit` uses, so one constant covers both.
  const lineEditInsetX = theme.widgets.lineEdit.normal.contentMargin.left;

  // --- Sample row -------------------------------------------------------
  const sampleFill = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const sampleColor = useGodotLinearColor(sampleFill);
  const overbrightTexture = useNodeIcon(solveNode.icons.overbright_indicator, COLOR_PICKER_OVERBRIGHT_ICON);
  const overbright = isColorOverbright(fill);
  const sampleCols = rows.sample ? sampleRowColumns(rows.sample, theme, props.pickerShape) : null;
  const sampleQuadRect = sampleCols ? { w: sampleCols.sample.w, h: sampleCols.sample.h * COLOR_PICKER_SAMPLE_HEIGHT_FRACTION } : null;
  const pickButtonBox = theme.widgets.button.normal;
  const pickIconTexture = useNodeIcon(solveNode.icons.screen_picker, COLOR_PICKER_PIPETTE_ICON);
  // `shape_rect` is only correct at `SHAPE_HSV_RECTANGLE` — every other shape stays undrawn (out of scope, `comparison.md`).
  const isHsvRectangle = (props.pickerShape ?? SHAPE_HSV_RECTANGLE) === SHAPE_HSV_RECTANGLE;
  const shapeIconTexture = useNodeIcon(solveNode.icons.shape_rect, isHsvRectangle ? COLOR_PICKER_SHAPE_RECT_ICON : null);
  const menuIconTexture = useNodeIcon(solveNode.icons.menu_option, COLOR_PICKER_MENU_ICON);
  const barArrowTexture = useNodeIcon(solveNode.icons.bar_arrow, COLOR_PICKER_BAR_ARROW_ICON);
  const defaultGrabberTexture = useNodeIcon(solveNode.icons.grabber, SLIDER_GRABBER_ICONS.grabber);
  const spinUpTexture = useNodeIcon(solveNode.icons.up, SPIN_BOX_ICONS.up);
  const spinDownTexture = useNodeIcon(solveNode.icons.down, SPIN_BOX_ICONS.down);
  // `up_icon_modulate`/`down_icon_modulate` default `control_font_color` (`default_theme.cpp:634,638`) — the SAME grey `CONTROL_FONT_COLOR` every label/value text already reads.
  const spinArrowColor = useMemo(() => srgbToLinearColor(multiplyModulate(tint.own, CONTROL_FONT_COLOR)), [tint.own]);

  // --- Shape row (SHAPE_HSV_RECTANGLE only) ------------------------------
  const shapeRects = rows.shape ? svAndHueRects(rows.shape, theme) : null;

  const baseTint = tint.own;
  const svBaseGeometry = useMemo(() => {
    if (!shapeRects) return null;
    const g = svSquareBaseLayer(shapeRects.svSquare.w, shapeRects.svSquare.h);
    return buildGeometry({ ...g, colors: tintVertexColors(g.colors, baseTint) });
  }, [shapeRects, baseTint]);

  const svHueGeometry = useMemo(() => {
    if (!shapeRects) return null;
    const g = svSquareHueLayer(shapeRects.svSquare.w, shapeRects.svSquare.h, hsv.h);
    return buildGeometry({ ...g, colors: tintVertexColors(g.colors, baseTint) });
  }, [shapeRects, hsv.h, baseTint]);

  const hueStrip = useMemo(() => {
    if (!shapeRects) return null;
    const g = hueStripGeometry(shapeRects.hueSlider.w, shapeRects.hueSlider.h);
    return buildGeometry({ ...g, colors: tintVertexColors(g.colors, baseTint) });
  }, [shapeRects, baseTint]);

  const cursorBgTexture = useNodeIcon(solveNode.icons.picker_cursor_bg, COLOR_PICKER_CURSOR_BG_ICON);
  const cursorTexture = useNodeIcon(solveNode.icons.picker_cursor, COLOR_PICKER_CURSOR_ICON);
  const cursorSize = Math.round(COLOR_PICKER_CURSOR_SIZE * scale);
  const cursorLocal = shapeRects
    ? svSquareCursorPosition({ x: 0, y: 0, w: shapeRects.svSquare.w, h: shapeRects.svSquare.h }, hsv.s, hsv.v)
    : null;
  const cursorBgFill = useMemo(() => multiplyModulate(tint.own, { ...fill, a: 1 }), [tint.own, fill]);
  const cursorBgColor = useGodotLinearColor(cursorBgFill);

  const hueLineColor = useMemo(() => {
    const inverted = invertRgb(hsvToRgb(hsv.h, 1, 1));
    return multiplyModulate(tint.own, inverted);
  }, [hsv.h, tint.own]);
  const hueLineLinear = useGodotLinearColor(hueLineColor);
  const hueY = shapeRects ? hueIndicatorY(shapeRects.hueSlider.h, hsv.h) : 0;

  // --- Mode row -----------------------------------------------------------
  const modeCols = rows.mode ? modeRowButtonRects(rows.mode, theme) : null;

  // --- Slider grid ----------------------------------------------------------
  const colorMode = props.colorMode ?? MODE_RGB;
  const editAlpha = props.editAlpha ?? true;
  const editIntensity = props.editIntensity ?? true;
  const sliderRowCount = rows.sliders ? colorPickerSliderRowCount(props) : 0;
  const channels = useMemo(() => colorModeChannels(colorMode, fill), [colorMode, fill]);
  const alphaChannel = useMemo(() => colorModeAlphaChannel(colorMode, fill), [colorMode, fill]);
  const intensityChannel = useMemo(() => colorModeIntensityChannel(fill), [fill]);
  const sliderLabelWidth = colorPickerLabelColumnWidth(theme, measure, colorPickerSliderLabels(colorMode, editAlpha, editIntensity));
  const sliderValueWidth = colorPickerValueColumnWidth(theme, measure);
  const sliderCols = useMemo(
    () => (rows.sliders ? sliderGridRowRects(rows.sliders, sliderRowCount, theme, sliderLabelWidth, sliderValueWidth) : []),
    [rows.sliders, sliderRowCount, theme, sliderLabelWidth, sliderValueWidth]
  );

  interface SliderRowContent {
    label: string;
    valueText: string;
    stops: ControlColor[];
    overlay?: { base: ControlColor; alpha: number };
    /** `value/max` (every channel's own `min` is 0 but intensity's, handled separately) — the grabber's own position, both the overridden `bar_arrow` and the stock chrome's default circle read this. */
    ratio: number;
    /** `GRADIENT_COLOR_SPACE_LINEAR_SRGB` (`color_mode.cpp:311`) — only `MODE_LINEAR`'s own R/G/B rows (`svGradient.ts`'s `linearizeStops` own doc). */
    linearSpace?: boolean;
  }

  // The single tested source of truth for row ORDER (`colorModes.test.ts`'s
  // own `colorPickerSliderLabels` cases) — every push below is checked
  // against it once, right after the loop, rather than trusted to stay in
  // sync by construction.
  const sliderLabels = useMemo(() => colorPickerSliderLabels(colorMode, editAlpha, editIntensity), [colorMode, editAlpha, editIntensity]);

  const sliderRows: SliderRowContent[] = useMemo(() => {
    const out: SliderRowContent[] = [];
    // `SpinBox::_update_text` (`spin_box.cpp:97-99`): `value = prefix + " " + value`
    // — a SPACE joins the prefix and the number, never a bare concatenation.
    const formatValue = (c: ColorModeChannel, prefixPlus?: boolean) => {
      const text = formatSliderValue(c.value, c.decimals);
      return prefixPlus && c.value >= 0 ? `+ ${text}` : text;
    };
    for (let i = 0; i < 3; i++) {
      const c = channels[i]!;
      let stops: ControlColor[] = [];
      let overlay: { base: ControlColor; alpha: number } | undefined;
      if (colorMode === MODE_RGB || colorMode === MODE_LINEAR) {
        stops = rgbChannelGradientStops(i, normalized);
      } else if (colorMode === MODE_HSV) {
        if (i === 0) {
          overlay = { base: hsvHueChannelBase(normalized), alpha: hsvHueChannelOverlayAlpha(normalized) };
        } else {
          stops = hsvChannelGradientStops(i as 1 | 2, normalized);
        }
      } else if (colorMode === MODE_OKHSL) {
        if (i === 0) stops = okhslHueChannelStops(normalized);
        else if (i === 1) stops = okhslSaturationGradientStops(normalized);
        else stops = okhslLightnessGradientStops(normalized);
      }
      out.push({
        label: sliderLabels[out.length] ?? c.label,
        valueText: formatSliderValue(c.value, c.decimals),
        stops,
        overlay,
        ratio: c.max !== 0 ? c.value / c.max : 0,
        linearSpace: colorMode === MODE_LINEAR,
      });
    }
    if (editIntensity) {
      out.push({
        label: sliderLabels[out.length] ?? intensityChannel.label,
        valueText: formatValue(intensityChannel, true),
        stops: [],
        ratio: colorPickerIntensityRatio(intensityChannel.value),
      });
    }
    if (editAlpha) {
      out.push({
        label: sliderLabels[out.length] ?? alphaChannel.label,
        valueText: formatSliderValue(alphaChannel.value, alphaChannel.decimals),
        stops: alphaChannelGradientStops(normalized),
        ratio: alphaChannel.max !== 0 ? alphaChannel.value / alphaChannel.max : 0,
      });
    }
    return out;
  }, [channels, alphaChannel, intensityChannel, colorMode, normalized, editAlpha, editIntensity, sliderLabels]);

  const sliderGeometries = useMemo(
    () =>
      sliderRows.map((row, i) => {
        if (row.stops.length < 2) return null;
        const col = sliderCols[i];
        if (!col) return null;
        const stops = row.linearSpace ? linearizeStops(row.stops) : row.stops;
        const g = horizontalStripGeometry(col.slider.w, Math.min(col.slider.h, 16 * scale), stops);
        return buildGeometry({ ...g, colors: tintVertexColors(g.colors, baseTint) });
      }),
    [sliderRows, sliderCols, baseTint, scale]
  );

  // --- Hex row --------------------------------------------------------------
  const hexCols = rows.hex ? hexRowColumns(rows.hex, theme) : null;
  const hexContent = useMemo(() => hexFieldText(fill, editAlpha), [fill, editAlpha]);

  // --- Swatches row -----------------------------------------------------
  const swatchesCols = rows.swatches ? swatchesRowRects(rows.swatches, theme) : null;
  // `btn_preset`/`btn_recent_preset` start unpressed (never toggled — no
  // `.tscn` property reaches either, `swatchesRowRects`' own doc for why the
  // grid stays collapsed), so `_update_drop_down_arrow` always picks
  // `folded_arrow` (`color_picker.cpp:1024-1030`), never `expanded_arrow`.
  const dropdownArrowTexture = useNodeIcon(solveNode.icons.folded_arrow, FOLDABLE_CONTAINER_ICONS.foldedArrow);
  // `h_separation`, "Button" (`default_theme.cpp:171`) — numerically the SAME
  // `round(4 * scale)` as `theme.separation` (BoxContainer's own), a
  // different theme key that coincides in value, not identity.
  const buttonIconTextSeparation = theme.separation;

  return (
    <CanvasItemGroup position={[theme.contentMargin, -theme.contentMargin, 0]}>
      {/* Sample row */}
      {rows.sample && sampleCols && sampleQuadRect && (
        <>
          <CanvasItemGroup position={[sampleCols.pick.x, -sampleCols.pick.y, 0]}>
            <StyleBoxQuad styleBox={pickButtonBox} rect={{ x: 0, y: 0, w: sampleCols.pick.w, h: sampleCols.pick.h }} color={tint.own} renderOrder={renderOrder} />
          </CanvasItemGroup>
          <CenteredIcon rect={sampleCols.pick} size={COLOR_PICKER_BUTTON_ICON_SIZE} texture={pickIconTexture} tint={tint} renderOrder={renderOrder} />
          {sampleCols.shape && <CenteredIcon rect={sampleCols.shape} size={COLOR_PICKER_BUTTON_ICON_SIZE} texture={shapeIconTexture} tint={tint} renderOrder={renderOrder} />}
          <CanvasItemGroup position={[sampleCols.sample.x, -sampleCols.sample.y, 0]}>
            {sampleFill.a < 1 && (
              <AlphaCheckerboardQuad
                width={sampleQuadRect.w}
                height={sampleQuadRect.h}
                color={tint.color}
                opacity={tint.opacity}
                renderOrder={renderOrder}
                themed={solveNode.icons.sample_bg}
              />
            )}
            <ControlQuad width={sampleQuadRect.w} height={sampleQuadRect.h} color={sampleColor} opacity={sampleFill.a} renderOrder={renderOrder} />
            {overbright && (
              <CanvasItemGroup position={[sampleCols.sample.w * 0.5, 0, 0]}>
                <ControlQuad width={16} height={16} color={tint.color} opacity={tint.opacity} map={overbrightTexture} renderOrder={renderOrder} />
              </CanvasItemGroup>
            )}
          </CanvasItemGroup>
        </>
      )}

      {/* Shape row */}
      {shapeRects && svBaseGeometry && svHueGeometry && hueStrip && cursorLocal && (
        <>
          <CanvasItemGroup position={[shapeRects.svSquare.x, -shapeRects.svSquare.y, 0]}>
            <GradientMesh geometry={svBaseGeometry} renderOrder={renderOrder} clippingPlanes={clippingPlanes} />
            <GradientMesh geometry={svHueGeometry} renderOrder={renderOrder} clippingPlanes={clippingPlanes} />
            <CanvasItemGroup position={[cursorLocal.x - cursorSize / 2, -(cursorLocal.y - cursorSize / 2), 0]}>
              <ControlQuad width={cursorSize} height={cursorSize} color={cursorBgColor} opacity={cursorBgFill.a} map={cursorBgTexture} renderOrder={renderOrder} />
              <ControlQuad width={cursorSize} height={cursorSize} color={tint.color} opacity={tint.opacity} map={cursorTexture} renderOrder={renderOrder} />
            </CanvasItemGroup>
          </CanvasItemGroup>
          <CanvasItemGroup position={[shapeRects.hueSlider.x, -shapeRects.hueSlider.y, 0]}>
            <GradientMesh geometry={hueStrip} renderOrder={renderOrder} clippingPlanes={clippingPlanes} />
            <CanvasItemGroup position={[0, -hueY, 0]}>
              <ControlQuad width={shapeRects.hueSlider.w} height={1} color={hueLineLinear} opacity={hueLineColor.a} renderOrder={renderOrder} />
            </CanvasItemGroup>
          </CanvasItemGroup>
        </>
      )}

      {/* Mode row */}
      {rows.mode && modeCols && (
        <>
          {modeCols.buttons.map((r, i) => (
            <CanvasItemGroup key={`${COLOR_MODE_NAMES[i]}-box`} position={[r.x, -r.y, 0]}>
              <StyleBoxQuad
                styleBox={colorPickerModeButtonStyleBox(theme, colorMode === i)}
                rect={{ x: 0, y: 0, w: r.w, h: r.h }}
                color={tint.own}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          ))}
          {modeCols.buttons.map((r, i) => (
            <LabelledText
              key={COLOR_MODE_NAMES[i]}
              rect={r}
              layout={shape(COLOR_MODE_NAMES[i]!)}
              fontSizePx={fontSizePx}
              tint={colorMode === i ? pressedFontColor : fontColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
              center
            />
          ))}
          <CenteredIcon rect={modeCols.dropdown} size={COLOR_PICKER_BUTTON_ICON_SIZE} texture={menuIconTexture} tint={tint} renderOrder={renderOrder} />
        </>
      )}

      {/* Slider grid */}
      {rows.sliders &&
        sliderRows.map((row, i) => {
          const col = sliderCols[i];
          if (!col) return null;
          const geometry = sliderGeometries[i];
          // `_reset_sliders_theme` (`color_picker.cpp:628-651`): every row but
          // intensity overrides the grabber to `bar_arrow` (this module's own
          // doc) — `row.overlay`/`row.stops` both only ever populate for a
          // colorized row, so their presence doubles as that same test.
          const isColorized = row.stops.length >= 2 || !!row.overlay;
          const grabberIconSize = isColorized ? { x: COLOR_PICKER_BUTTON_ICON_SIZE, y: COLOR_PICKER_BUTTON_ICON_SIZE } : { x: theme.sliderGrabberSize, y: theme.sliderGrabberSize };
          const sliderBox = colorPickerSliderBoxRect(col.slider, theme, grabberIconSize);
          const sliderBoxSize = { x: sliderBox.w, y: sliderBox.h };
          return (
            <CanvasItemGroup key={`${row.label}-${i}`} position={[0, 0, 0]}>
              <LabelledText rect={col.label} layout={shape(row.label)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} />
              <CanvasItemGroup position={[sliderBox.x, -sliderBox.y, 0]}>
                {!isColorized &&
                  (() => {
                    const trackRect = sliderTrackRect(false, sliderBoxSize, theme);
                    const fillRect = sliderGrabberAreaRect(false, sliderBoxSize, row.ratio, theme, grabberIconSize);
                    const gr = sliderGrabberRect(false, sliderBoxSize, row.ratio, grabberIconSize);
                    return (
                      <>
                        <CanvasItemGroup position={[trackRect.x, -trackRect.y, 0]}>
                          <StyleBoxQuad styleBox={theme.widgets.slider.track} rect={{ x: 0, y: 0, w: trackRect.w, h: trackRect.h }} color={tint.own} renderOrder={renderOrder} />
                        </CanvasItemGroup>
                        <CanvasItemGroup position={[fillRect.x, -fillRect.y, 0]}>
                          <StyleBoxQuad styleBox={theme.widgets.slider.fill} rect={{ x: 0, y: 0, w: fillRect.w, h: fillRect.h }} color={tint.own} renderOrder={renderOrder} />
                        </CanvasItemGroup>
                        <CanvasItemGroup position={[gr.x, -gr.y, 0]}>
                          <ControlQuad width={gr.w} height={gr.h} color={tint.color} opacity={tint.opacity} map={defaultGrabberTexture} renderOrder={renderOrder} />
                        </CanvasItemGroup>
                      </>
                    );
                  })()}
                {row.overlay && (
                  <ControlQuad
                    width={sliderBox.w}
                    height={sliderBox.h}
                    color={srgbToLinearColor(multiplyModulate(tint.own, row.overlay.base))}
                    opacity={tint.opacity}
                    renderOrder={renderOrder}
                  />
                )}
                {geometry && <GradientMesh geometry={geometry} renderOrder={renderOrder} clippingPlanes={clippingPlanes} linear={row.linearSpace} />}
                {isColorized &&
                  (() => {
                    const offsetPx = Math.round(COLOR_PICKER_SLIDER_GRABBER_OFFSET * scale);
                    const gr = colorPickerChannelGrabberRect(sliderBoxSize, row.ratio, grabberIconSize, offsetPx);
                    return (
                      <CanvasItemGroup position={[gr.x, -gr.y, 0]}>
                        <ControlQuad width={gr.w} height={gr.h} color={tint.color} opacity={tint.opacity} map={barArrowTexture} renderOrder={renderOrder} />
                      </CanvasItemGroup>
                    );
                  })()}
              </CanvasItemGroup>
              {(() => {
                // `SpinBox::_compute_sizes` (`spin_box.cpp:392-397`): the
                // `LineEdit` box and the up/down buttons block share the
                // column — the box (and the right-aligned text inside it)
                // covers only `fieldRect`, never the buttons block beside it.
                const spinLayout = spinBoxLayout({ x: col.value.w, y: col.value.h }, SPIN_BOX_ARROW_ICON_SIZE.x);
                const fieldRect = { x: col.value.x + spinLayout.fieldRect.x, y: col.value.y + spinLayout.fieldRect.y, w: spinLayout.fieldRect.w, h: spinLayout.fieldRect.h };
                const upRect = { x: col.value.x + spinLayout.upRect.x, y: col.value.y + spinLayout.upRect.y, w: spinLayout.upRect.w, h: spinLayout.upRect.h };
                const downRect = { x: col.value.x + spinLayout.downRect.x, y: col.value.y + spinLayout.downRect.y, w: spinLayout.downRect.w, h: spinLayout.downRect.h };
                const upIconPos = { x: upRect.x + (upRect.w - SPIN_BOX_ARROW_ICON_SIZE.x) / 2, y: upRect.y + (upRect.h - SPIN_BOX_ARROW_ICON_SIZE.y) / 2 };
                const downIconPos = { x: downRect.x + (downRect.w - SPIN_BOX_ARROW_ICON_SIZE.x) / 2, y: downRect.y + (downRect.h - SPIN_BOX_ARROW_ICON_SIZE.y) / 2 };
                return (
                  <>
                    <CanvasItemGroup position={[fieldRect.x, -fieldRect.y, 0]}>
                      <StyleBoxQuad styleBox={theme.widgets.lineEdit.normal} rect={{ x: 0, y: 0, w: fieldRect.w, h: fieldRect.h }} color={tint.own} renderOrder={renderOrder} />
                    </CanvasItemGroup>
                    <LabelledText rect={fieldRect} layout={shape(row.valueText)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} alignRight inset={lineEditInsetX} />
                    <CanvasItemGroup position={[upIconPos.x, -upIconPos.y, 0]}>
                      <ControlQuad width={SPIN_BOX_ARROW_ICON_SIZE.x} height={SPIN_BOX_ARROW_ICON_SIZE.y} color={spinArrowColor} opacity={tint.opacity} map={spinUpTexture} renderOrder={renderOrder} />
                    </CanvasItemGroup>
                    <CanvasItemGroup position={[downIconPos.x, -downIconPos.y, 0]}>
                      <ControlQuad width={SPIN_BOX_ARROW_ICON_SIZE.x} height={SPIN_BOX_ARROW_ICON_SIZE.y} color={spinArrowColor} opacity={tint.opacity} map={spinDownTexture} renderOrder={renderOrder} />
                    </CanvasItemGroup>
                  </>
                );
              })()}
            </CanvasItemGroup>
          );
        })}

      {/* Hex row */}
      {rows.hex && hexCols && (
        <>
          <LabelledText rect={hexCols.label} layout={shape(hexContent.label)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} />
          {hexContent.typeText && (
            <LabelledText rect={hexCols.textType} layout={shape(hexContent.typeText)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} center />
          )}
          <CanvasItemGroup position={[hexCols.field.x, -hexCols.field.y, 0]}>
            <StyleBoxQuad styleBox={theme.widgets.lineEdit.normal} rect={{ x: 0, y: 0, w: hexCols.field.w, h: hexCols.field.h }} color={tint.own} renderOrder={renderOrder} />
          </CanvasItemGroup>
          <LabelledText rect={hexCols.field} layout={shape(hexContent.text)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} inset={lineEditInsetX} />
        </>
      )}

      {/* Swatches row */}
      {rows.swatches && swatchesCols && (
        <>
          <CanvasItemGroup
            position={[swatchesCols.swatchesButton.x, -(swatchesCols.swatchesButton.y + (swatchesCols.swatchesButton.h - COLOR_PICKER_BUTTON_ICON_SIZE) / 2), 0]}
          >
            <ControlQuad width={COLOR_PICKER_BUTTON_ICON_SIZE} height={COLOR_PICKER_BUTTON_ICON_SIZE} color={tint.color} opacity={tint.opacity} map={dropdownArrowTexture} renderOrder={renderOrder} />
          </CanvasItemGroup>
          <LabelledText
            rect={{ ...swatchesCols.swatchesButton, x: swatchesCols.swatchesButton.x + COLOR_PICKER_BUTTON_ICON_SIZE + buttonIconTextSeparation }}
            layout={shape('Swatches')}
            fontSizePx={fontSizePx}
            tint={fontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
          <CenteredIcon rect={swatchesCols.menuButton} size={COLOR_PICKER_BUTTON_ICON_SIZE} texture={menuIconTexture} tint={tint} renderOrder={renderOrder} />
          <CanvasItemGroup
            position={[
              swatchesCols.recentColorsButton.x,
              -(swatchesCols.recentColorsButton.y + (swatchesCols.recentColorsButton.h - COLOR_PICKER_BUTTON_ICON_SIZE) / 2),
              0,
            ]}
          >
            <ControlQuad width={COLOR_PICKER_BUTTON_ICON_SIZE} height={COLOR_PICKER_BUTTON_ICON_SIZE} color={tint.color} opacity={tint.opacity} map={dropdownArrowTexture} renderOrder={renderOrder} />
          </CanvasItemGroup>
          <LabelledText
            rect={{ ...swatchesCols.recentColorsButton, x: swatchesCols.recentColorsButton.x + COLOR_PICKER_BUTTON_ICON_SIZE + buttonIconTextSeparation }}
            layout={shape('Recent Colors')}
            fontSizePx={fontSizePx}
            tint={fontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </>
      )}
    </CanvasItemGroup>
  );
}

/** `useGodotLinearColor` is a hook and cannot run inside a conditional/`.map()` callback — this reproduces its one-line sRGB→linear conversion directly for the (rare, alpha-uniform) HSV hue-row base layer. */
function srgbToLinearColor(c: ControlColor): THREE.Color {
  const toLinear = (v: number) => (v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return new THREE.Color(toLinear(c.r), toLinear(c.g), toLinear(c.b));
}
