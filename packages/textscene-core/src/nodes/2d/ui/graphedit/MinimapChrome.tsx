/**
 * `<GraphEditMinimapChrome>`: paints `GraphEditMinimap`, the overview panel at the
 * bottom-right of GraphEdit (`scene/gui/graph_edit.cpp:3325-3340`), from the geometry of
 * `minimap.ts`. `_minimap_draw` (`:1807-1891`) draws the panel, the GraphFrames, the
 * GraphNodes, the connections, the camera rect and the resizer icon.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useEffect, useMemo } from 'react';
import { flatStyleBox as makeFlatStyleBox } from '../../../../r3f/controls/native/styleBoxFlat';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { canvasItemFacing } from '../../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../../r3f/materialProgramInputs';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { CONNECTION_SRGB_VERTEX_COLORS } from './ConnectionLine';
import { minimapConnectionLines } from './minimapConnections';
import { polylineStrokeGeometry } from './polylineStroke';
import {
  GRAPH_EDIT_ICON_SIZE,
  GRAPH_EDIT_MINIMAP_RESIZER_ICON,
} from '../../../../r3f/controls/native/themeIcons';
import { DEFAULT_CONTENT_MARGIN } from '../../../../r3f/controls/godotDefaultTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { ResolvedConnection } from './connectionEndpoints';
import type { MinimapTransform, GraphScrollBounds, MinimapElement } from './minimap';
import { minimapCameraRect, minimapNodeRect } from './minimap';

/** `draw_polyline_colors(points, colors, 0.5, lines_antialiased)` (`graph_edit.cpp:1611`). */
const MINIMAP_LINE_WIDTH = 0.5;

/** `GraphEditMinimap`'s `resizer_color` (`default_theme.cpp:1350`). */
const RESIZER_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 0.85 };

function flatBox(
  bgColor: ControlColor,
  cornerRadius: number,
  borderWidth: number,
  borderColor: ControlColor
): StyleBoxFlatData {
  return makeFlatStyleBox(bgColor, { cornerRadius, borderWidth, borderColor });
}

interface MinimapConnectionsProps {
  connections: readonly ResolvedConnection[];
  transform: MinimapTransform;
  bounds: GraphScrollBounds;
  curvature: number;
  /** `connection_lines_antialiased` (`graph_edit.h:254`, default true), whose only engine reader is this draw. */
  antialiased: boolean;
  /** The minimap opacity, folded onto the inherited tint. */
  lineTint: ControlColor;
  renderOrder: number;
}

/**
 * Every connection as one mesh: the polylines are coplanar, share a material and paint in
 * one band, so the draw count does not grow with the graph. The points and colours come from
 * `minimapConnections.ts`, and the stroke from `polylineStroke.ts` (`:1870-1883`, `:1611`).
 */
function MinimapConnections({ connections, transform, bounds, curvature, antialiased, lineTint, renderOrder }: MinimapConnectionsProps) {
  const clippingPlanes = useControlClipPlanes();
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    for (const line of minimapConnectionLines(connections, transform, bounds, curvature)) {
      const stroke = polylineStrokeGeometry(
        line.points,
        line.colors.map((c) => multiplyModulate(lineTint, c)),
        MINIMAP_LINE_WIDTH,
        antialiased
      );
      const base = positions.length / 3;
      positions.push(...stroke.positions);
      colors.push(...stroke.colors);
      for (const index of stroke.indices) indices.push(base + index);
    }
    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setIndex(indices);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    return geo;
  }, [connections, transform, bounds, curvature, antialiased, lineTint]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  const program = materialProgramInputs({
    props: {
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      injection: CONNECTION_SRGB_VERTEX_COLORS,
      clippingPlanes: clippingPlanes as THREE.Plane[],
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

export interface GraphEditMinimapProps {
  /** The rect of the minimap panel in GraphEdit's local space. */
  rect: Rect2;
  transform: MinimapTransform;
  bounds: GraphScrollBounds;
  /** Frames first, then nodes, as the two loops of `_minimap_draw` run. */
  elements: readonly MinimapElement[];
  /** `GraphEdit::zoom`, which scales each element's box before conversion (`:1827-1829`). */
  zoom: number;
  scrollOffset: { x: number; y: number };
  graphEditSize: { x: number; y: number };
  /** `minimap->get_modulate().a`. */
  opacity: number;
  /** Every connection `_update_connections` resolved, in GraphEdit's order. */
  connections: readonly ResolvedConnection[];
  /** `connection_lines_curvature`, the same curve the main canvas draws. */
  curvature: number;
  /** `connection_lines_antialiased`. */
  connectionLinesAntialiased: boolean;
  icons: NativeControlComponentProps['solveNode']['icons'];
  theme: NativeControlComponentProps['theme'];
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

export function GraphEditMinimapChrome({
  rect,
  transform,
  bounds,
  elements,
  zoom,
  scrollOffset,
  graphEditSize,
  opacity,
  connections,
  curvature,
  connectionLinesAntialiased,
  icons,
  theme,
  tint,
  renderOrder,
}: GraphEditMinimapProps) {
  const scale = theme.contentMargin / DEFAULT_CONTENT_MARGIN;
  // `minimap->set_modulate(Color(1, 1, 1, minimap_opacity))` (`:3330`) multiplies every draw
  // inside the minimap, so it folds into each sRGB colour before the linear conversion.
  const modulated = useMemo(
    () => multiplyModulate(tint.own, { r: 1, g: 1, b: 1, a: opacity }),
    [tint.own, opacity]
  );

  // `default_theme.cpp:1342`: make_flat_stylebox(Color(0.24, 0.24, 0.24), 0, 0, 0, 0).
  const panelStyle = useMemo(
    () => flatBox({ r: 0.24, g: 0.24, b: 0.24, a: 1 }, theme.cornerRadius, 0, { r: 0.8, g: 0.8, b: 0.8, a: 1 }),
    [theme.cornerRadius]
  );
  // `default_theme.cpp:1343-1345`: make_flat_stylebox(Color(0.65, 0.65, 0.65, 0.2), 0, 0, 0, 0, 0),
  // then `set_border_width_all(1)` and `set_border_color(Color(0.65, 0.65, 0.65, 0.45))`, both unscaled.
  const cameraStyle = useMemo(
    () => flatBox({ r: 0.65, g: 0.65, b: 0.65, a: 0.2 }, 0, 1, { r: 0.65, g: 0.65, b: 0.65, a: 0.45 }),
    []
  );
  // `default_theme.cpp:1347`: make_flat_stylebox(Color(1, 1, 1), 0, 0, 0, 0, 2). Each element replaces the bg.
  const nodeCornerRadius = Math.round(2 * scale);

  const resizerTexture = useNodeIcon(icons.resizer, GRAPH_EDIT_MINIMAP_RESIZER_ICON);
  const resizerColor = useGodotLinearColor(useMemo(() => multiplyModulate(modulated, RESIZER_COLOR), [modulated]));
  const resizerOpacity = modulated.a * RESIZER_COLOR.a;

  const cameraRect = minimapCameraRect(transform, bounds, scrollOffset, graphEditSize);

  return (
    <CanvasItemGroup position={[rect.x, -rect.y, 0]}>
      <StyleBoxQuad
        styleBox={panelStyle}
        color={modulated}
        rect={{ x: 0, y: 0, w: rect.w, h: rect.h }}
        renderOrder={renderOrder}
      />

      {elements.map((element) => {
        const nodeRect = minimapNodeRect(transform, bounds, element, zoom);
        const style = flatBox(element.bgColor, nodeCornerRadius, 0, { r: 0.8, g: 0.8, b: 0.8, a: 1 });
        return (
          <CanvasItemGroup key={element.key} position={[nodeRect.x, -nodeRect.y, 0]}>
            <StyleBoxQuad
              styleBox={style}
              color={modulated}
              rect={{ x: 0, y: 0, w: nodeRect.w, h: nodeRect.h }}
              renderOrder={renderOrder + 0.02}
            />
          </CanvasItemGroup>
        );
      })}

      <MinimapConnections
        connections={connections}
        transform={transform}
        bounds={bounds}
        curvature={curvature}
        antialiased={connectionLinesAntialiased}
        lineTint={modulated}
        renderOrder={renderOrder + 0.03}
      />

      <CanvasItemGroup position={[cameraRect.x, -cameraRect.y, 0]}>
        <StyleBoxQuad
          styleBox={cameraStyle}
          color={modulated}
          rect={{ x: 0, y: 0, w: cameraRect.w, h: cameraRect.h }}
          renderOrder={renderOrder + 0.04}
        />
      </CanvasItemGroup>

      {resizerTexture && (
        <ControlQuad
          width={GRAPH_EDIT_ICON_SIZE}
          height={GRAPH_EDIT_ICON_SIZE}
          color={resizerColor}
          opacity={resizerOpacity}
          map={resizerTexture}
          renderOrder={renderOrder + 0.06}
        />
      )}
    </CanvasItemGroup>
  );
}
