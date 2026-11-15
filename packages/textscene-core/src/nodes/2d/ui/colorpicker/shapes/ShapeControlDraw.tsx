/**
 * What a shape Control's `draw` callback draws on it, at its own rect, in Godot's draw order: the
 * shader fill, the SV square, the cursors, then the slider (`color_picker_shape.cpp`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { themedIconSize } from '../../../../../r3f/controls/native/scaledSvgIcon';
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../../../r3f/controls/native/controlQuad';
import { useNodeIcon } from '../../../../../r3f/controls/native/useIconTexture';
import { PositionedIcon } from '../../../../../r3f/controls/native/PositionedIcon';
import { painterView, type SolveNode } from '../../../../../r3f/controls/native/solveTree';
import type { NativeControlComponentProps } from '../../../../../r3f/controls/ControlComponentRegistry';
import type { ControlProperties } from '../../control/types';
import {
  COLOR_PICKER_CURSOR_BG_ICON,
  COLOR_PICKER_CURSOR_ICON,
  COLOR_PICKER_CURSOR_SIZE,
} from '../../../../../r3f/controls/native/themeIcons';
import { HAIRLINE_THICKNESS_PX, hairlineQuadStartPx } from '../../../../../r3f/controls/native/hairline';
import {
  multiplyModulate,
  useItemLinearColor,
  type OwnPixelTint,
} from '../../../../../r3f/canvasItemModulate';
import type { Rgba } from '../../../../../godot/math/math';
import { TintedGradient } from '../GradientMesh';
import { svSquareBaseLayer, svSquareHueLayer, verticalStripGeometry } from '../svGradient';
import { ShapeShaderQuad } from './ShapeShaderQuad';
import type { PickerShapeColor, ShapeCursor, ShapeDraw, ShapeSlider, SvSquare } from './shapeDrawing';

/** A shape Control's properties: its callback and what the callback reads of the picker. */
export interface ShapeControlDrawProperties {
  shapeDraw: ShapeDraw;
  shapeColor: PickerShapeColor;
  /** The picker's `color`: a cursor's background takes it opaque. */
  pickColor: Rgba;
}

export function ShapeControlDraw({ solveNode, rect, tint, theme, renderOrder }: NativeControlComponentProps) {
  const { shapeDraw, shapeColor, pickColor } = painterView<ControlProperties & ShapeControlDrawProperties>(
    solveNode
  );
  const { w, h } = rect;
  const drawing = useMemo(() => shapeDraw({ x: 0, y: 0, w, h }, shapeColor), [shapeDraw, w, h, shapeColor]);
  return (
    <>
      {drawing.fill && (
        <CanvasItemGroup position={[drawing.fill.rect.x, -drawing.fill.rect.y, 0]}>
          <ShapeShaderQuad fill={drawing.fill} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
      {drawing.svSquare && <SvSquareLayers square={drawing.svSquare} tint={tint} renderOrder={renderOrder} />}
      {drawing.cursors.map((cursor, i) => (
        <Cursor
          key={i}
          cursor={cursor}
          pickColor={pickColor}
          solveNode={solveNode}
          tint={tint}
          scale={theme.scale}
          renderOrder={renderOrder}
        />
      ))}
      {drawing.slider && <Slider slider={drawing.slider} tint={tint} renderOrder={renderOrder} />}
    </>
  );
}

/** `draw_sv_square`'s two polygons (`color_picker_shape.cpp:231-257`). */
function SvSquareLayers({
  square,
  tint,
  renderOrder,
}: {
  square: SvSquare;
  tint: OwnPixelTint;
  renderOrder: number;
}) {
  const { w, h } = square.rect;
  const base = useMemo(() => svSquareBaseLayer(w, h), [w, h]);
  const hue = useMemo(() => svSquareHueLayer(w, h, square.hue), [w, h, square.hue]);
  return (
    <CanvasItemGroup position={[square.rect.x, -square.rect.y, 0]}>
      <TintedGradient layer={base} tint={tint} renderOrder={renderOrder} />
      <TintedGradient layer={hue} tint={tint} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

const CURSOR_SIZE = { x: COLOR_PICKER_CURSOR_SIZE, y: COLOR_PICKER_CURSOR_SIZE };

/**
 * `draw_cursor` (`color_picker_shape.cpp:268-274`): both icons start where the ring centres on the
 * cursor, and `draw_texture` draws each at its own size.
 */
function Cursor({
  cursor,
  pickColor,
  solveNode,
  tint,
  scale,
  renderOrder,
}: {
  cursor: ShapeCursor;
  pickColor: Rgba;
  solveNode: SolveNode;
  tint: OwnPixelTint;
  scale: number;
  renderOrder: number;
}) {
  const backgroundTexture = useNodeIcon(
    cursor.hasBackground ? solveNode.icons.picker_cursor_bg : undefined,
    cursor.hasBackground ? COLOR_PICKER_CURSOR_BG_ICON : null
  );
  const ringTexture = useNodeIcon(solveNode.icons.picker_cursor, COLOR_PICKER_CURSOR_ICON);
  const background = useMemo(() => multiplyModulate(tint.own, { ...pickColor, a: 1 }), [tint.own, pickColor]);
  const backgroundColor = useItemLinearColor(background);
  const ringSize = themedIconSize(solveNode.textureSlots, 'picker_cursor', CURSOR_SIZE, scale);
  const backgroundSize = themedIconSize(solveNode.textureSlots, 'picker_cursor_bg', CURSOR_SIZE, scale);
  const x = cursor.centre.x - ringSize.x / 2;
  const y = cursor.centre.y - ringSize.y / 2;
  return (
    <>
      {cursor.hasBackground && (
        <PositionedIcon
          rect={{ x, y, w: backgroundSize.x, h: backgroundSize.y }}
          texture={backgroundTexture}
          color={backgroundColor}
          opacity={background.a}
          renderOrder={renderOrder}
        />
      )}
      <PositionedIcon
        rect={{ x, y, w: ringSize.x, h: ringSize.y }}
        texture={ringTexture}
        color={tint.color}
        opacity={tint.opacity}
        renderOrder={renderOrder}
      />
    </>
  );
}

/** The slider's strip and its 1 px line (`draw_line` at width -1, `color_picker_shape.cpp:433`). */
function Slider({
  slider,
  tint,
  renderOrder,
}: {
  slider: ShapeSlider;
  tint: OwnPixelTint;
  renderOrder: number;
}) {
  const { w, h } = slider.rect;
  const strip = useMemo(() => verticalStripGeometry(w, h, slider.stops), [w, h, slider.stops]);
  const line = useMemo(() => multiplyModulate(tint.own, slider.lineColor), [tint.own, slider.lineColor]);
  const lineColor = useItemLinearColor(line);
  return (
    <CanvasItemGroup position={[slider.rect.x, -slider.rect.y, 0]}>
      <TintedGradient layer={strip} tint={tint} renderOrder={renderOrder} />
      <CanvasItemGroup position={[0, -hairlineQuadStartPx(slider.lineY), 0]}>
        <ControlQuad
          width={w}
          height={HAIRLINE_THICKNESS_PX}
          color={lineColor}
          opacity={line.a}
          renderOrder={renderOrder}
        />
      </CanvasItemGroup>
    </CanvasItemGroup>
  );
}
