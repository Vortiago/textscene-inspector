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
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import {
  multiplyModulate,
  useItemLinearColor,
  useItemLinearColorOf,
  useVertexColorTint,
} from '../../../../r3f/canvasItemModulate';
import { parseColor } from '../../../../utils/colorParser';
import { AlphaCheckerboardQuad } from '../shared/AlphaCheckerboardQuad';
import {
  COLOR_PICKER_BAR_ARROW_ICON,
  COLOR_PICKER_BUTTON_ICON_SIZE,
  COLOR_PICKER_MENU_ICON,
  COLOR_PICKER_OVERBRIGHT_ICON,
  COLOR_PICKER_PIPETTE_ICON,
  COLOR_PICKER_SHAPE_ICONS,
  FOLDABLE_CONTAINER_ICONS,
  SLIDER_GRABBER_ICONS,
} from '../../../../r3f/controls/native/themeIcons';
import { sliderTrackRect, sliderGrabberAreaRect, sliderGrabberRect } from '../shared/sliderSolver';
import { spinBoxArrowPosition, spinBoxLayout, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import { SPIN_BOX_ICONS } from '../spinbox/icons';
import { isColorOverbright } from '../shared/colorOverbright';
import { TextDirection } from '../../../../godot/text/textServerEnums';
import { pickerChildTheme } from './pickerChildTheme';
import { IconButton, iconModulate } from '../../../../r3f/controls/native/IconButton';
import { GradientMesh, buildGeometry, tintVertexColors } from './GradientMesh';
import { LabelledText } from '../shared/LabelledText';
import { TextTypeScriptIcon } from './TextTypeScriptIcon';
import { ButtonLabel } from '../../../../r3f/controls/native/ButtonLabel';
import type { ButtonLabelBox } from '../../../../r3f/controls/native/buttonBase';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import {
  infersRtl,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { buttonIconColor } from '../button/nativeSolver';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  COLOR_MODE_NAMES,
  COLOR_PICKER_SAMPLE_HEIGHT_FRACTION,
  COLOR_PICKER_THEME_FONT_KEY,
  colorPickerChannelGrabberRect,
  colorPickerIntensityRatio,
  colorPickerLabelColumnWidth,
  modeButtonBox,
  colorPickerRows,
  colorPickerSliderBoxRect,
  colorPickerSliderRowCount,
  colorPickerValueColumnWidth,
  colorPickerEmWidthPx,
  presetButtonContent,
  type ButtonText,
  modeButtonLabel,
  textTypeLabel,
  COLOR_PICKER_SLIDER_GRABBER_OFFSET,
  hexRowColumns,
  modeRowButtonRects,
  MODE_BUTTON_COUNT,
  sampleRowColumns,
  sliderGridRowRects,
  swatchesRowRects,
  type TextWidthMeasurer,
} from './nativeSolver';
import { horizontalStripGeometry, linearizeStops } from './svGradient';
import { ShapeRow } from './shapes/ShapeRow';
import { pickerShapeColor } from './shapes/shapeDrawing';
import { shapeRowSplit } from './shapes/shapeRow';
import { drawnShapeVariant } from './shapes/pickerShapes';
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
  hsvHueChannelLayers,
  okhslHueChannelStops,
  okhslLightnessGradientStops,
  okhslSaturationGradientStops,
  rgbChannelGradientStops,
  type ColorModeChannel,
} from './colorModes';
import type { ColorPickerProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';
import { CONTROL_FONT_COLOR } from '../../../../godot/scene/theme';

/** The picker's child Buttons keep the `text_direction` and `language` defaults. */
const AUTO_TEXT_DIRECTION = { textDirection: TextDirection.TEXT_DIRECTION_AUTO, language: '' };

export function ColorPicker({
  solveNode,
  tint,
  rect,
  renderOrder,
  theme: defaultTheme,
}: NativeControlComponentProps) {
  const child = pickerChildTheme(solveNode, defaultTheme);
  const theme = child.theme;
  const toItemLinear = useItemLinearColorOf();
  const props = painterView<ColorPickerProperties>(solveNode);
  const fill = useMemo(() => parseColor(props.color), [props.color]);
  const normalized = useMemo(() => colorNormalized(fill), [fill]);
  const shapeColor = useMemo(() => pickerShapeColor(normalized), [normalized]);
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const scale = theme.scale;

  const fontSizePx = theme.fontSize;
  // Read in the render body, not a `useMemo` (`Label`'s `Component.tsx` says why).
  const fontMetrics = resolveNodeFontMetrics(solveNode, COLOR_PICKER_THEME_FONT_KEY);
  // Keyed by text only, so a new font size or face (a font that finished loading) starts an empty cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layoutCache = useMemo(() => new Map<string, TextLayoutResult>(), [fontSizePx, fontMetrics]);
  const shape = (text: string): TextLayoutResult => {
    let layout = layoutCache.get(text);
    if (!layout) {
      layout = shapeButtonLabel(text, { fontSizePx, fontMetrics });
      layoutCache.set(text, layout);
    }
    return layout;
  };
  const measure: TextWidthMeasurer = (text) => {
    const l = shape(text);
    return { x: shapedTextSizeWidthPx(l.widthPx), y: l.heightPx };
  };

  const buttonText = (text: string): ButtonText => ({
    size: measure(text),
    direction: { rtl: solveNode.rtl, isTextRtl: infersRtl(shape(text)) },
  });
  // One Button label as `Button::_notification` draws it. The picker's Buttons never trim.
  const buttonLabel = (key: string, text: string, tintOfText: Rgba, box: ButtonLabelBox) => (
    <ButtonLabel
      key={key}
      layout={shape(text)}
      box={box}
      overrunBehavior={undefined}
      isWrapped={false}
      bidi={bidi}
      fontSizePx={fontSizePx}
      tint={tintOfText}
      outline={textOutline}
      clippingPlanes={clippingPlanes}
      renderOrder={renderOrder}
    />
  );

  const contentWidth = Math.max(0, rect.w - 2 * theme.contentMargin);
  const rows = useMemo(
    () => colorPickerRows(contentWidth, theme, child.valueFieldTheme, props, measure),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      contentWidth,
      theme,
      child.valueFieldTheme,
      props.pickerShape,
      props.samplerVisible,
      props.colorModesVisible,
      props.slidersVisible,
      props.hexVisible,
      props.presetsVisible,
      props.editAlpha,
      props.editIntensity,
      props.colorMode,
      fontSizePx,
      fontMetrics,
    ]
  );

  const textOutline = useTintedTextOutline(solveNode, tint.own);
  const bidi = useControlBidiOptions(AUTO_TEXT_DIRECTION, solveNode);
  const labelColor = useMemo(() => multiplyModulate(tint.own, child.labelColor), [tint.own, child]);
  const buttonFontColor = useMemo(() => multiplyModulate(tint.own, child.buttonColor), [tint.own, child]);
  const pressedFontColor = useMemo(
    () => multiplyModulate(tint.own, child.buttonPressedColor),
    [tint.own, child]
  );
  // The picker's Buttons modulate their icons by `icon_normal_color` of the Theme chain (`button.cpp:321-329`).
  const iconTint = useMemo(
    () => iconModulate(toItemLinear, tint, buttonIconColor(child.buttonColors, 'normal')),
    [tint, child, toItemLinear]
  );
  const lineEditFontColor = useMemo(() => multiplyModulate(tint.own, child.lineEditColor), [tint.own, child]);
  const spinArrowGrey = useMemo(() => multiplyModulate(tint.own, CONTROL_FONT_COLOR), [tint.own]);
  const valueFieldFontColor = useMemo(
    () => multiplyModulate(tint.own, child.valueFieldColor),
    [tint.own, child]
  );
  const lineEditInsetX = theme.widgets.lineEdit.normal.contentMargin.left;
  const valueFieldInsetX = child.valueFieldTheme.widgets.lineEdit.normal.contentMargin.left;

  const sampleFill = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const sampleColor = useItemLinearColor(sampleFill);
  const overbrightTexture = useNodeIcon(solveNode.icons.overbright_indicator, COLOR_PICKER_OVERBRIGHT_ICON);
  const overbright = isColorOverbright(fill);
  const sampleCols = rows.sample
    ? sampleRowColumns(rows.sample, theme, props.pickerShape, solveNode.rtl)
    : null;
  const sampleQuadRect = sampleCols
    ? { w: sampleCols.sample.w, h: sampleCols.sample.h * COLOR_PICKER_SAMPLE_HEIGHT_FRACTION }
    : null;
  // `btn_shape`, `btn_mode` and `menu_btn` use `FlatMenuButton`, whose boxes are `StyleBoxEmpty`
  // (`default_theme.cpp:360,372-375`). Only `btn_pick`, a plain `Button` (`default_theme.cpp:138-141`), draws one.
  const pickIconTexture = useNodeIcon(solveNode.icons.screen_picker, COLOR_PICKER_PIPETTE_ICON);
  const variant = drawnShapeVariant(props.pickerShape);
  const shapeIcon = variant?.icon ?? null;
  const shapeIconTexture = useNodeIcon(
    shapeIcon ? solveNode.icons[shapeIcon] : undefined,
    shapeIcon ? COLOR_PICKER_SHAPE_ICONS[shapeIcon] : null
  );
  const menuIconTexture = useNodeIcon(solveNode.icons.menu_option, COLOR_PICKER_MENU_ICON);
  const barArrowTexture = useNodeIcon(solveNode.icons.bar_arrow, COLOR_PICKER_BAR_ARROW_ICON);
  const defaultGrabberTexture = useNodeIcon(solveNode.icons.grabber, SLIDER_GRABBER_ICONS.grabber);
  const spinUpTexture = useNodeIcon(solveNode.icons.up, SPIN_BOX_ICONS.up);
  const spinDownTexture = useNodeIcon(solveNode.icons.down, SPIN_BOX_ICONS.down);
  // `up_icon_modulate` and `down_icon_modulate` default to `control_font_color` (`default_theme.cpp:634,638`).
  const spinArrowColor = useItemLinearColor(spinArrowGrey);

  const vertexTint = useVertexColorTint(tint.own);
  const baseTint = vertexTint.vertex;

  const shapeDrawing = useMemo(() => {
    if (!rows.shape || !variant) return null;
    return variant.draw(shapeRowSplit(rows.shape, theme, variant.layout, solveNode.rtl), shapeColor);
  }, [rows.shape, theme, variant, solveNode.rtl, shapeColor]);

  const modeCols = rows.mode
    ? modeRowButtonRects(
        rows.mode,
        theme,
        solveNode.rtl,
        COLOR_MODE_NAMES.slice(0, MODE_BUTTON_COUNT).map((name) => measure(name).x),
        props.colorMode ?? MODE_RGB
      )
    : null;

  const colorMode = props.colorMode ?? MODE_RGB;
  const editAlpha = props.editAlpha ?? true;
  const editIntensity = props.editIntensity ?? true;
  const sliderRowCount = rows.sliders ? colorPickerSliderRowCount(props) : 0;
  const channels = useMemo(() => colorModeChannels(colorMode, fill), [colorMode, fill]);
  const alphaChannel = useMemo(() => colorModeAlphaChannel(colorMode, fill), [colorMode, fill]);
  const intensityChannel = useMemo(() => colorModeIntensityChannel(fill), [fill]);
  const sliderLabelWidth = colorPickerLabelColumnWidth(
    theme,
    measure,
    colorPickerSliderLabels(colorMode, editAlpha, editIntensity)
  );
  // The unceiled advance: `Font::get_char_size` does not ceil it, where `measure` does.
  const emWidthPx = colorPickerEmWidthPx((text) => shape(text).widthPx);
  const sliderValueWidth = colorPickerValueColumnWidth(child.valueFieldTheme, emWidthPx);
  const sliderCols = useMemo(
    () =>
      rows.sliders
        ? sliderGridRowRects(
            rows.sliders,
            sliderRowCount,
            theme,
            sliderLabelWidth,
            sliderValueWidth,
            solveNode.rtl
          )
        : [],
    [rows.sliders, sliderRowCount, theme, sliderLabelWidth, sliderValueWidth, solveNode.rtl]
  );

  interface SliderRowContent {
    label: string;
    valueText: string;
    stops: Rgba[];
    /**
     * Drawn under the gradient: the alpha row's `sample_bg` tiles (`color_picker.cpp:1434`), or the
     * HSV H row's grey polygon, over which the hue texture is modulated (`color_mode.cpp:218-221`).
     */
    underlay?: { kind: 'checkerboard' } | { kind: 'grey'; color: Rgba };
    /** The grabber position, `value/max`. Every channel's `min` is 0 except intensity's, which has its own ratio. */
    ratio: number;
    /** `GRADIENT_COLOR_SPACE_LINEAR_SRGB` (`color_mode.cpp:311`): only the R, G and B rows of `MODE_LINEAR`. */
    linearSpace?: boolean;
  }

  // The tested source of the row order: each row below takes its label from here by index.
  const sliderLabels = useMemo(
    () => colorPickerSliderLabels(colorMode, editAlpha, editIntensity),
    [colorMode, editAlpha, editIntensity]
  );

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
      let stops: Rgba[] = [];
      let underlay: SliderRowContent['underlay'];
      if (colorMode === MODE_RGB || colorMode === MODE_LINEAR) {
        stops = rgbChannelGradientStops(i, normalized);
      } else if (colorMode === MODE_HSV) {
        if (i === 0) {
          const hue = hsvHueChannelLayers(normalized);
          underlay = { kind: 'grey', color: hue.base };
          stops = hue.stops;
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
        underlay,
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
        underlay: { kind: 'checkerboard' },
        ratio: alphaChannel.max !== 0 ? alphaChannel.value / alphaChannel.max : 0,
      });
    }
    return out;
  }, [
    channels,
    alphaChannel,
    intensityChannel,
    colorMode,
    normalized,
    editAlpha,
    editIntensity,
    sliderLabels,
  ]);

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
  const dropdownArrowTexture = useNodeIcon(
    solveNode.icons.folded_arrow,
    FOLDABLE_CONTAINER_ICONS.foldedArrow
  );

  return (
    <CanvasItemGroup position={[theme.contentMargin, -theme.contentMargin, 0]}>
      {/* Sample row */}
      {rows.sample && sampleCols && sampleQuadRect && (
        <>
          <IconButton
            rect={sampleCols.pick}
            box={theme.widgets.button.normal}
            size={COLOR_PICKER_BUTTON_ICON_SIZE}
            texture={pickIconTexture}
            tint={tint}
            iconTint={iconTint}
            rtl={solveNode.rtl}
            iconAlignment={HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER}
            renderOrder={renderOrder}
          />
          {sampleCols.shape && (
            <IconButton
              rect={sampleCols.shape}
              box={theme.widgets.flatMenuButton.normal}
              size={COLOR_PICKER_BUTTON_ICON_SIZE}
              texture={shapeIconTexture}
              tint={tint}
              iconTint={iconTint}
              rtl={solveNode.rtl}
              iconAlignment={HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER}
              renderOrder={renderOrder}
            />
          )}
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
            <ControlQuad
              width={sampleQuadRect.w}
              height={sampleQuadRect.h}
              color={sampleColor}
              opacity={sampleFill.a}
              renderOrder={renderOrder}
            />
            {overbright && (
              <CanvasItemGroup position={[sampleCols.sample.w * 0.5, 0, 0]}>
                <ControlQuad
                  width={16}
                  height={16}
                  color={tint.color}
                  opacity={tint.opacity}
                  map={overbrightTexture}
                  renderOrder={renderOrder}
                />
              </CanvasItemGroup>
            )}
          </CanvasItemGroup>
        </>
      )}

      {shapeDrawing && (
        <ShapeRow
          drawing={shapeDrawing}
          pickColor={fill}
          solveNode={solveNode}
          tint={tint}
          scale={scale}
          renderOrder={renderOrder}
        />
      )}

      {/* Mode row */}
      {rows.mode && modeCols && (
        <>
          {modeCols.buttons.map((r, i) => (
            <CanvasItemGroup key={`${COLOR_MODE_NAMES[i]}-box`} position={[r.x, -r.y, 0]}>
              <StyleBoxQuad
                styleBox={modeButtonBox(theme, i, colorMode)}
                rect={{ x: 0, y: 0, w: r.w, h: r.h }}
                color={tint.own}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          ))}
          {modeCols.buttons.map((r, i) =>
            buttonLabel(
              COLOR_MODE_NAMES[i]!,
              COLOR_MODE_NAMES[i]!,
              colorMode === i ? pressedFontColor : buttonFontColor,
              modeButtonLabel(r, theme, modeButtonBox(theme, i, colorMode), buttonText(COLOR_MODE_NAMES[i]!))
            )
          )}
          <IconButton
            rect={modeCols.dropdown}
            box={theme.widgets.flatMenuButton.normal}
            size={COLOR_PICKER_BUTTON_ICON_SIZE}
            texture={menuIconTexture}
            tint={tint}
            iconTint={iconTint}
            rtl={solveNode.rtl}
            iconAlignment={HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER}
            renderOrder={renderOrder}
          />
        </>
      )}

      {/* Slider grid */}
      {rows.sliders &&
        sliderRows.map((row, i) => {
          const col = sliderCols[i];
          if (!col) return null;
          const geometry = sliderGeometries[i];
          // `_reset_sliders_theme` (`color_picker.cpp:628-651`) gives every row but intensity the
          // `bar_arrow` grabber and a gradient band. Only such a row has `stops`.
          // Intensity keeps the stock `HSlider` track, fill and grabber.
          const isColorized = row.stops.length >= 2;
          const grabberIconSize = isColorized
            ? { x: COLOR_PICKER_BUTTON_ICON_SIZE, y: COLOR_PICKER_BUTTON_ICON_SIZE }
            : { x: theme.sliderGrabberSize, y: theme.sliderGrabberSize };
          const sliderBox = colorPickerSliderBoxRect(col.slider, theme, grabberIconSize);
          const sliderBoxSize = { x: sliderBox.w, y: sliderBox.h };
          // `margin = 16 * base_scale` (`color_mode.cpp:187`, `color_picker.cpp:1433`): the grey, the rainbow and the checkerboard share it.
          const bandHeight = Math.min(col.slider.h, 16 * scale);
          return (
            <CanvasItemGroup key={`${row.label}-${i}`} position={[0, 0, 0]}>
              <LabelledText
                rect={col.label}
                layout={shape(row.label)}
                fontSizePx={fontSizePx}
                tint={labelColor}
                clippingPlanes={clippingPlanes}
                renderOrder={renderOrder}
                rtl={solveNode.rtl}
              />
              <CanvasItemGroup position={[sliderBox.x, -sliderBox.y, 0]}>
                {!isColorized &&
                  (() => {
                    const trackRect = sliderTrackRect(false, sliderBoxSize, theme);
                    // Every internal slider is a child Control, so it resolves
                    // the picker's own `is_layout_rtl()` (`control.cpp:3551-3620`).
                    const fillRect = sliderGrabberAreaRect(
                      false,
                      sliderBoxSize,
                      row.ratio,
                      theme,
                      grabberIconSize,
                      solveNode.rtl
                    );
                    const gr = sliderGrabberRect(
                      false,
                      sliderBoxSize,
                      row.ratio,
                      grabberIconSize,
                      solveNode.rtl
                    );
                    return (
                      <>
                        <CanvasItemGroup position={[trackRect.x, -trackRect.y, 0]}>
                          <StyleBoxQuad
                            styleBox={theme.widgets.slider.track}
                            rect={{ x: 0, y: 0, w: trackRect.w, h: trackRect.h }}
                            color={tint.own}
                            renderOrder={renderOrder}
                          />
                        </CanvasItemGroup>
                        <CanvasItemGroup position={[fillRect.x, -fillRect.y, 0]}>
                          <StyleBoxQuad
                            styleBox={theme.widgets.slider.fill}
                            rect={{ x: 0, y: 0, w: fillRect.w, h: fillRect.h }}
                            color={tint.own}
                            renderOrder={renderOrder}
                          />
                        </CanvasItemGroup>
                        <CanvasItemGroup position={[gr.x, -gr.y, 0]}>
                          <ControlQuad
                            width={gr.w}
                            height={gr.h}
                            color={tint.color}
                            opacity={tint.opacity}
                            map={defaultGrabberTexture}
                            renderOrder={renderOrder}
                          />
                        </CanvasItemGroup>
                      </>
                    );
                  })()}
                {row.underlay?.kind === 'checkerboard' && (
                  <AlphaCheckerboardQuad
                    width={sliderBox.w}
                    height={bandHeight}
                    color={tint.color}
                    opacity={tint.opacity}
                    renderOrder={renderOrder}
                    themed={solveNode.icons.sample_bg}
                  />
                )}
                {row.underlay?.kind === 'grey' && (
                  <ControlQuad
                    width={sliderBox.w}
                    height={bandHeight}
                    color={toItemLinear(multiplyModulate(tint.own, row.underlay.color))}
                    opacity={tint.opacity}
                    renderOrder={renderOrder}
                  />
                )}
                {geometry && (
                  <GradientMesh
                    geometry={geometry}
                    renderOrder={renderOrder}
                    clippingPlanes={clippingPlanes}
                    linear={row.linearSpace}
                    tint={vertexTint}
                  />
                )}
                {isColorized &&
                  (() => {
                    const offsetPx = Math.round(COLOR_PICKER_SLIDER_GRABBER_OFFSET * scale);
                    const gr = colorPickerChannelGrabberRect(
                      sliderBoxSize,
                      row.ratio,
                      grabberIconSize,
                      offsetPx,
                      solveNode.rtl
                    );
                    return (
                      <CanvasItemGroup position={[gr.x, -gr.y, 0]}>
                        <ControlQuad
                          width={gr.w}
                          height={gr.h}
                          color={tint.color}
                          opacity={tint.opacity}
                          map={barArrowTexture}
                          renderOrder={renderOrder}
                        />
                      </CanvasItemGroup>
                    );
                  })()}
              </CanvasItemGroup>
              {(() => {
                // `SpinBox::_compute_sizes` (`spin_box.cpp:392-397`): the `LineEdit` box
                // covers only `fieldRect`, and the up/down buttons block sits beside it.
                const spinLayout = spinBoxLayout(
                  { x: col.value.w, y: col.value.h },
                  SPIN_BOX_ARROW_ICON_SIZE.x,
                  solveNode.rtl
                );
                const fieldRect = {
                  x: col.value.x + spinLayout.fieldRect.x,
                  y: col.value.y + spinLayout.fieldRect.y,
                  w: spinLayout.fieldRect.w,
                  h: spinLayout.fieldRect.h,
                };
                const upRect = {
                  x: col.value.x + spinLayout.upRect.x,
                  y: col.value.y + spinLayout.upRect.y,
                  w: spinLayout.upRect.w,
                  h: spinLayout.upRect.h,
                };
                const downRect = {
                  x: col.value.x + spinLayout.downRect.x,
                  y: col.value.y + spinLayout.downRect.y,
                  w: spinLayout.downRect.w,
                  h: spinLayout.downRect.h,
                };
                const upIconPos = spinBoxArrowPosition(upRect, SPIN_BOX_ARROW_ICON_SIZE);
                const downIconPos = spinBoxArrowPosition(downRect, SPIN_BOX_ARROW_ICON_SIZE);
                return (
                  <>
                    <CanvasItemGroup position={[fieldRect.x, -fieldRect.y, 0]}>
                      <StyleBoxQuad
                        styleBox={child.valueFieldTheme.widgets.lineEdit.normal}
                        rect={{ x: 0, y: 0, w: fieldRect.w, h: fieldRect.h }}
                        color={tint.own}
                        renderOrder={renderOrder}
                      />
                    </CanvasItemGroup>
                    <LabelledText
                      rect={fieldRect}
                      layout={shape(row.valueText)}
                      fontSizePx={fontSizePx}
                      tint={valueFieldFontColor}
                      clippingPlanes={clippingPlanes}
                      renderOrder={renderOrder}
                      alignRight
                      inset={valueFieldInsetX}
                      rtl={solveNode.rtl}
                    />
                    <CanvasItemGroup position={[upIconPos.x, -upIconPos.y, 0]}>
                      <ControlQuad
                        width={SPIN_BOX_ARROW_ICON_SIZE.x}
                        height={SPIN_BOX_ARROW_ICON_SIZE.y}
                        color={spinArrowColor}
                        opacity={tint.opacity}
                        map={spinUpTexture}
                        renderOrder={renderOrder}
                      />
                    </CanvasItemGroup>
                    <CanvasItemGroup position={[downIconPos.x, -downIconPos.y, 0]}>
                      <ControlQuad
                        width={SPIN_BOX_ARROW_ICON_SIZE.x}
                        height={SPIN_BOX_ARROW_ICON_SIZE.y}
                        color={spinArrowColor}
                        opacity={tint.opacity}
                        map={spinDownTexture}
                        renderOrder={renderOrder}
                      />
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
          <LabelledText
            rect={hexCols.label}
            layout={shape(hexContent.label)}
            fontSizePx={fontSizePx}
            tint={labelColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
            rtl={solveNode.rtl}
          />
          {hexContent.typeText ? (
            buttonLabel(
              'text-type',
              hexContent.typeText,
              buttonFontColor,
              textTypeLabel(hexCols.textType, theme, buttonText(hexContent.typeText))
            )
          ) : (
            <TextTypeScriptIcon
              rect={hexCols.textType}
              solveNode={solveNode}
              theme={theme}
              buttonColors={child.buttonColors}
              tint={tint}
              renderOrder={renderOrder}
            />
          )}
          <CanvasItemGroup position={[hexCols.field.x, -hexCols.field.y, 0]}>
            <StyleBoxQuad
              styleBox={theme.widgets.lineEdit.normal}
              rect={{ x: 0, y: 0, w: hexCols.field.w, h: hexCols.field.h }}
              color={tint.own}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
          <LabelledText
            rect={hexCols.field}
            layout={shape(hexContent.text)}
            fontSizePx={fontSizePx}
            tint={lineEditFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
            inset={lineEditInsetX}
            rtl={solveNode.rtl}
          />
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
            // (`color_picker.cpp:2242-2248,2279-2283`). RTL swaps both sides (`button.cpp:262-276`).
            const { icon, label } = presetButtonContent(box, theme, buttonText(text));
            return (
              <CanvasItemGroup key={key} position={[0, 0, 0]}>
                <PositionedIcon
                  rect={icon}
                  texture={dropdownArrowTexture}
                  color={iconTint.color}
                  opacity={iconTint.opacity}
                  renderOrder={renderOrder}
                />
                {buttonLabel(key, text, buttonFontColor, label)}
              </CanvasItemGroup>
            );
          })}
          <IconButton
            rect={swatchesCols.menuButton}
            box={theme.widgets.flatMenuButton.normal}
            size={COLOR_PICKER_BUTTON_ICON_SIZE}
            texture={menuIconTexture}
            tint={tint}
            iconTint={iconTint}
            rtl={solveNode.rtl}
            iconAlignment={HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER}
            renderOrder={renderOrder}
          />
        </>
      )}
    </CanvasItemGroup>
  );
}
