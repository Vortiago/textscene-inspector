/**
 * `<ShapeRow>`: paints one `ShapeDrawing` in its Control's own frame, in Godot's draw order: the
 * shader fill, the SV square, the cursors, then the slider.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { scaledIconSize } from '../../../../../r3f/controls/native/scaledSvgIcon';
import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../../../r3f/controls/native/controlQuad';
import { useNodeIcon } from '../../../../../r3f/controls/native/useIconTexture';
import { PositionedIcon } from '../../../../../r3f/controls/native/PositionedIcon';
import { useControlClipPlanes } from '../../../../../r3f/controls/native/controlClipping';
import type { SolveNode } from '../../../../../r3f/controls/native/solveTree';
import {
  COLOR_PICKER_CURSOR_BG_ICON,
  COLOR_PICKER_CURSOR_ICON,
  COLOR_PICKER_CURSOR_SIZE,
} from '../../../../../r3f/controls/native/themeIcons';
import { HAIRLINE_THICKNESS_PX, hairlineQuadStartPx } from '../../../../../r3f/controls/native/hairline';
import {
  multiplyModulate,
  useItemLinearColor,
  useVertexColorTint,
  type OwnPixelTint,
} from '../../../../../r3f/canvasItemModulate';
import type { Rgba } from '../../../../../godot/math/math';
import { GradientMesh, buildGeometry, tintVertexColors } from '../GradientMesh';
import { svSquareBaseLayer, svSquareHueLayer, verticalStripGeometry, type QuadGeometry } from '../svGradient';
import { ShapeShaderQuad } from './ShapeShaderQuad';
import type { ShapeCursor, ShapeDrawing, ShapeSlider, SvSquare } from './shapeDrawing';

interface ShapeRowProps {
  drawing: ShapeDrawing;
  /** The pick colour, `color_picker->color`: the cursor background takes it opaque. */
  pickColor: Rgba;
  solveNode: SolveNode;
  tint: OwnPixelTint;
  /** The theme scale: the default theme rasterises the cursor icons at it. */
  scale: number;
  renderOrder: number;
}

export function ShapeRow({ drawing, pickColor, solveNode, tint, scale, renderOrder }: ShapeRowProps) {
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
          size={scaledIconSize(COLOR_PICKER_CURSOR_SIZE, scale)}
          renderOrder={renderOrder}
        />
      ))}
      {drawing.slider && <Slider slider={drawing.slider} tint={tint} renderOrder={renderOrder} />}
    </>
  );
}

/** One vertex-coloured mesh at local (0, 0), with the item's tint in its colours. */
function TintedGradient({
  layer,
  tint,
  renderOrder,
}: {
  layer: QuadGeometry;
  tint: OwnPixelTint;
  renderOrder: number;
}) {
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const vertexTint = useVertexColorTint(tint.own);
  const geometry = useMemo(
    () => buildGeometry({ ...layer, colors: tintVertexColors(layer.colors, vertexTint.vertex) }),
    [layer, vertexTint.vertex]
  );
  return (
    <GradientMesh
      geometry={geometry}
      renderOrder={renderOrder}
      clippingPlanes={clippingPlanes}
      tint={vertexTint}
    />
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

/** `draw_cursor` (`color_picker_shape.cpp:269-275`). */
function Cursor({
  cursor,
  pickColor,
  solveNode,
  tint,
  size,
  renderOrder,
}: {
  cursor: ShapeCursor;
  pickColor: Rgba;
  solveNode: SolveNode;
  tint: OwnPixelTint;
  size: number;
  renderOrder: number;
}) {
  const backgroundTexture = useNodeIcon(
    cursor.hasBackground ? solveNode.icons.picker_cursor_bg : undefined,
    cursor.hasBackground ? COLOR_PICKER_CURSOR_BG_ICON : null
  );
  const ringTexture = useNodeIcon(solveNode.icons.picker_cursor, COLOR_PICKER_CURSOR_ICON);
  const background = useMemo(() => multiplyModulate(tint.own, { ...pickColor, a: 1 }), [tint.own, pickColor]);
  const backgroundColor = useItemLinearColor(background);
  const rect = { x: cursor.centre.x - size / 2, y: cursor.centre.y - size / 2, w: size, h: size };
  return (
    <>
      {cursor.hasBackground && (
        <PositionedIcon
          rect={rect}
          texture={backgroundTexture}
          color={backgroundColor}
          opacity={background.a}
          renderOrder={renderOrder}
        />
      )}
      <PositionedIcon
        rect={rect}
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
