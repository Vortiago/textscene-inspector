/**
 * The native (WebGL canvas) painter for ColorPicker. ColorPicker builds its
 * widget as internal children in its constructor
 * (`scene/gui/color_picker.cpp:2069-2260`), and no `.tscn` property reaches
 * them, so this one painter draws the rows of `nativeSolver.ts`'s `colorPickerRows`.
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

/** `control_font_color` in `default_theme.cpp` (`:100`), the default text colour of Label and Button. Only the pressed `mode_btns` entry reads another colour. */
const CONTROL_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_pressed_color` (`default_theme.cpp:105,156`): `Button`'s `font_pressed_color`, which the toggled-on `mode_btns[i]` reads. */
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
 * the interpolated vertex colour, not the attribute: interpolating two sRGB
 * colours in linear space moves the ramp's midpoint. A copy of the private
 * `decodeVertexColorsFromSRGB` in `StyleBoxQuad.tsx`.
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
  /** The vertex colours are already linear (`linearizeStops`), so the sRGB decode is skipped and the GPU's linear lerp reproduces `GRADIENT_COLOR_SPACE_LINEAR_SRGB`. */
  linear?: boolean;
}

/** One vertex-coloured, single-pass mesh: the SV square's two layers, the hue strip and every channel-slider band. */
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

/**
 * The rendering server applies a CanvasItem's accumulated modulate to every draw call,
 * so `tint.own` multiplies each colour in sRGB space before this painter's one decode,
 * the same order as `StyleBoxQuad.tsx`.
 */
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
  /** Right-aligns within `rect`, as the SpinBox's `LineEdit` does for a number (`line_edit.cpp`). A plain `Label` aligns left. */
  alignRight?: boolean;
  /** Centres within `rect`: `Button`'s default `alignment` (`button.h:54`), which `mode_btns` and `text_type` keep. `btn_preset` and `btn_recent_preset` set LEFT (`color_picker.cpp:2248,2283`). Wins over `alignRight`. */
  center?: boolean;
  /** The `x_ofs` floor of `LineEdit::_notification(NOTIFICATION_DRAW)`: the gap between the text and its aligned edge. 0 for a Label or Button, which has no box under the text. */
  inset?: number;
  /** `Control::is_layout_rtl()`: swaps the leading and trailing arms and leaves centre alone, as `label.cpp:497-509`, `line_edit.cpp:1397-1421` and `button.cpp:262-276` do. */
  rtl?: boolean;
}

/** One row of shaped text, vertically centred in `rect`. */
function LabelledText({ rect, layout, fontSizePx, tint, clippingPlanes, renderOrder, alignRight, center, inset = 0, rtl = false }: LabelledTextProps) {
  if (!layout) return null;
  const width = shapedTextSizeWidthPx(layout.widthPx);
  const trailing = Math.max(inset, rect.w - width - inset);
  const x = center ? Math.max(0, (rect.w - width) / 2) : (alignRight ?? false) !== rtl ? trailing : inset;
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

/** One button icon, centred inside `rect`. */
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
  // Read in the render body, not a `useMemo` (`Label`'s `Component.tsx` says why).
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
  // Every value and hex `LineEdit` uses the same box, so one inset covers both.
  const lineEditInsetX = theme.widgets.lineEdit.normal.contentMargin.left;

  const sampleFill = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const sampleColor = useGodotLinearColor(sampleFill);
  const overbrightTexture = useNodeIcon(solveNode.icons.overbright_indicator, COLOR_PICKER_OVERBRIGHT_ICON);
  const overbright = isColorOverbright(fill);
  const sampleCols = rows.sample ? sampleRowColumns(rows.sample, theme, props.pickerShape, solveNode.rtl) : null;
  const sampleQuadRect = sampleCols ? { w: sampleCols.sample.w, h: sampleCols.sample.h * COLOR_PICKER_SAMPLE_HEIGHT_FRACTION } : null;
  // `btn_shape`, `btn_mode` and `menu_btn` use `FlatMenuButton`, whose boxes are `StyleBoxEmpty`
  // (`default_theme.cpp:360,372-375`). Only `btn_pick`, a plain `Button` (`default_theme.cpp:138-141`), draws one.
  const pickButtonBox = theme.widgets.button.normal;
  const pickIconTexture = useNodeIcon(solveNode.icons.screen_picker, COLOR_PICKER_PIPETTE_ICON);
  // `shape_rect` is correct only at `SHAPE_HSV_RECTANGLE`. No other shape is drawn (`comparison.md`).
  const isHsvRectangle = (props.pickerShape ?? SHAPE_HSV_RECTANGLE) === SHAPE_HSV_RECTANGLE;
  const shapeIconTexture = useNodeIcon(solveNode.icons.shape_rect, isHsvRectangle ? COLOR_PICKER_SHAPE_RECT_ICON : null);
  const menuIconTexture = useNodeIcon(solveNode.icons.menu_option, COLOR_PICKER_MENU_ICON);
  const barArrowTexture = useNodeIcon(solveNode.icons.bar_arrow, COLOR_PICKER_BAR_ARROW_ICON);
  const defaultGrabberTexture = useNodeIcon(solveNode.icons.grabber, SLIDER_GRABBER_ICONS.grabber);
  const spinUpTexture = useNodeIcon(solveNode.icons.up, SPIN_BOX_ICONS.up);
  const spinDownTexture = useNodeIcon(solveNode.icons.down, SPIN_BOX_ICONS.down);
  // `up_icon_modulate` and `down_icon_modulate` default to `control_font_color` (`default_theme.cpp:634,638`).
  const spinArrowColor = useMemo(() => srgbToLinearColor(multiplyModulate(tint.own, CONTROL_FONT_COLOR)), [tint.own]);

  const shapeRects = rows.shape ? svAndHueRects(rows.shape, theme, solveNode.rtl) : null;

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

  const modeCols = rows.mode ? modeRowButtonRects(rows.mode, theme, solveNode.rtl) : null;

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
    () => (rows.sliders ? sliderGridRowRects(rows.sliders, sliderRowCount, theme, sliderLabelWidth, sliderValueWidth, solveNode.rtl) : []),
    [rows.sliders, sliderRowCount, theme, sliderLabelWidth, sliderValueWidth, solveNode.rtl]
  );

  interface SliderRowContent {
    label: string;
    valueText: string;
    stops: ControlColor[];
    overlay?: { base: ControlColor; alpha: number };
    /** The grabber position, `value/max`. Every channel's `min` is 0 except intensity's, which has its own ratio. */
    ratio: number;
    /** `GRADIENT_COLOR_SPACE_LINEAR_SRGB` (`color_mode.cpp:311`): only the R, G and B rows of `MODE_LINEAR`. */
    linearSpace?: boolean;
  }

  // The tested source of the row order: each row below takes its label from here by index.
  const sliderLabels = useMemo(() => colorPickerSliderLabels(colorMode, editAlpha, editIntensity), [colorMode, editAlpha, editIntensity]);

  const sliderRows: SliderRowContent[] = useMemo(() => {
    const out: SliderRowContent[] = [];
    // `SpinBox::_update_text` (`spin_box.cpp:97-99`): `value = prefix + " " + value`,
    // so a space joins the prefix and the number.
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

  const hexCols = rows.hex ? hexRowColumns(rows.hex, theme, solveNode.rtl) : null;
  const hexContent = useMemo(() => hexFieldText(fill, editAlpha), [fill, editAlpha]);

  const swatchesCols = rows.swatches ? swatchesRowRects(rows.swatches, theme, solveNode.rtl) : null;
  // No `.tscn` property presses `btn_preset` or `btn_recent_preset`, so
  // `_update_drop_down_arrow` picks `folded_arrow` (`color_picker.cpp:1024-1030`).
  const dropdownArrowTexture = useNodeIcon(solveNode.icons.folded_arrow, FOLDABLE_CONTAINER_ICONS.foldedArrow);
  // Button's `h_separation` (`default_theme.cpp:171`) is a different theme key
  // from BoxContainer's `separation`, with the same value `round(4 * scale)`.
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
          // `_reset_sliders_theme` (`color_picker.cpp:628-651`) gives every row but intensity the
          // `bar_arrow` grabber and a gradient band. Only such a row has `overlay` or `stops`.
          // Intensity keeps the stock `HSlider` track, fill and grabber.
          const isColorized = row.stops.length >= 2 || !!row.overlay;
          const grabberIconSize = isColorized ? { x: COLOR_PICKER_BUTTON_ICON_SIZE, y: COLOR_PICKER_BUTTON_ICON_SIZE } : { x: theme.sliderGrabberSize, y: theme.sliderGrabberSize };
          const sliderBox = colorPickerSliderBoxRect(col.slider, theme, grabberIconSize);
          const sliderBoxSize = { x: sliderBox.w, y: sliderBox.h };
          return (
            <CanvasItemGroup key={`${row.label}-${i}`} position={[0, 0, 0]}>
              <LabelledText rect={col.label} layout={shape(row.label)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} rtl={solveNode.rtl} />
              <CanvasItemGroup position={[sliderBox.x, -sliderBox.y, 0]}>
                {!isColorized &&
                  (() => {
                    const trackRect = sliderTrackRect(false, sliderBoxSize, theme);
                    // Every internal slider is a child Control, so it resolves
                    // the picker's own `is_layout_rtl()` (`control.cpp:3551-3620`).
                    const fillRect = sliderGrabberAreaRect(false, sliderBoxSize, row.ratio, theme, grabberIconSize, solveNode.rtl);
                    const gr = sliderGrabberRect(false, sliderBoxSize, row.ratio, grabberIconSize, solveNode.rtl);
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
                    const gr = colorPickerChannelGrabberRect(sliderBoxSize, row.ratio, grabberIconSize, offsetPx, solveNode.rtl);
                    return (
                      <CanvasItemGroup position={[gr.x, -gr.y, 0]}>
                        <ControlQuad width={gr.w} height={gr.h} color={tint.color} opacity={tint.opacity} map={barArrowTexture} renderOrder={renderOrder} />
                      </CanvasItemGroup>
                    );
                  })()}
              </CanvasItemGroup>
              {(() => {
                // `SpinBox::_compute_sizes` (`spin_box.cpp:392-397`): the `LineEdit` box
                // covers only `fieldRect`, and the up/down buttons block sits beside it.
                const spinLayout = spinBoxLayout({ x: col.value.w, y: col.value.h }, SPIN_BOX_ARROW_ICON_SIZE.x, solveNode.rtl);
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
                    <LabelledText rect={fieldRect} layout={shape(row.valueText)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} alignRight inset={lineEditInsetX} rtl={solveNode.rtl} />
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
          <LabelledText rect={hexCols.label} layout={shape(hexContent.label)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} rtl={solveNode.rtl} />
          {hexContent.typeText && (
            <LabelledText rect={hexCols.textType} layout={shape(hexContent.typeText)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} center />
          )}
          <CanvasItemGroup position={[hexCols.field.x, -hexCols.field.y, 0]}>
            <StyleBoxQuad styleBox={theme.widgets.lineEdit.normal} rect={{ x: 0, y: 0, w: hexCols.field.w, h: hexCols.field.h }} color={tint.own} renderOrder={renderOrder} />
          </CanvasItemGroup>
          <LabelledText rect={hexCols.field} layout={shape(hexContent.text)} fontSizePx={fontSizePx} tint={fontColor} clippingPlanes={clippingPlanes} renderOrder={renderOrder} inset={lineEditInsetX} rtl={solveNode.rtl} />
        </>
      )}

      {/* Swatches row */}
      {rows.swatches && swatchesCols && (
        <>
          {[
            { key: 'swatches', box: swatchesCols.swatchesButton, text: 'Swatches' },
            { key: 'recent', box: swatchesCols.recentColorsButton, text: 'Recent Colors' },
          ].map(({ key, box, text }) => {
            // Both buttons have the default `icon_alignment` and LEFT text
            // (`color_picker.cpp:2242-2248,2279-2283`). RTL swaps both sides (`button.cpp:262-276`),
            // so the icon goes to the trailing edge and the text aligns right.
            const iconX = solveNode.rtl ? box.x + box.w - COLOR_PICKER_BUTTON_ICON_SIZE : box.x;
            const textBox = {
              ...box,
              x: solveNode.rtl ? box.x : box.x + COLOR_PICKER_BUTTON_ICON_SIZE + buttonIconTextSeparation,
              w: Math.max(0, box.w - COLOR_PICKER_BUTTON_ICON_SIZE - buttonIconTextSeparation),
            };
            return (
              <CanvasItemGroup key={key} position={[0, 0, 0]}>
                <CanvasItemGroup position={[iconX, -(box.y + (box.h - COLOR_PICKER_BUTTON_ICON_SIZE) / 2), 0]}>
                  <ControlQuad width={COLOR_PICKER_BUTTON_ICON_SIZE} height={COLOR_PICKER_BUTTON_ICON_SIZE} color={tint.color} opacity={tint.opacity} map={dropdownArrowTexture} renderOrder={renderOrder} />
                </CanvasItemGroup>
                <LabelledText
                  rect={textBox}
                  layout={shape(text)}
                  fontSizePx={fontSizePx}
                  tint={fontColor}
                  clippingPlanes={clippingPlanes}
                  renderOrder={renderOrder}
                  rtl={solveNode.rtl}
                />
              </CanvasItemGroup>
            );
          })}
          <CenteredIcon rect={swatchesCols.menuButton} size={COLOR_PICKER_BUTTON_ICON_SIZE} texture={menuIconTexture} tint={tint} renderOrder={renderOrder} />
        </>
      )}
    </CanvasItemGroup>
  );
}

/** The conversion of `useGodotLinearColor`, for a colour inside a `.map()` callback, where a hook cannot run. */
function srgbToLinearColor(c: ControlColor): THREE.Color {
  const toLinear = (v: number) => (v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return new THREE.Color(toLinear(c.r), toLinear(c.g), toLinear(c.b));
}
