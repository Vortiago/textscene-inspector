/**
 * `<GraphEdit>` — the native (WebGL canvas) painter for `GraphEdit`:
 * `GraphEdit::_notification(NOTIFICATION_DRAW)` (`scene/gui/graph_edit.cpp:853-865`)
 * — background panel, then the grid, then every resolvable `connections`
 * entry (`GraphEdit::_update_connections`, `:1614-1660` — this painter draws
 * them at ITS OWN `renderOrder`, same as the grid, so they sit BEHIND every
 * GraphElement child; Godot instead moves `connections_layer` to just above
 * the grid and below every GraphFrame/GraphNode, `graph_edit.cpp:717` — a
 * known draw-order divergence, `comparison.md`'s own note). `panel_focus`
 * (`has_focus(true)`) is never drawn: a static, pointer-less preview never
 * holds focus, the same restriction every other Control painter in this
 * codebase carries.
 *
 * NOT DRAWN, and why:
 *
 *  - The toolbar (zoom controls, minimap, arrange button) — `menu_panel`/
 *    `menu_hbox`/`zoom_label`/every button/`minimap` are `INTERNAL_MODE_*`
 *    children the CONSTRUCTOR builds at a hardcoded runtime position
 *    (`Vector2(10, 10)`) and `PRESET_FULL_RECT` anchors (`graph_edit.cpp:3225-
 *    3169+`) — nothing about their geometry OR content (a generic zoom-
 *    percentage label, stock icons) is described by the scene file, only
 *    their six `show_*` visibility bools are. `type_names`, `zoom_min/max/
 *    step`, `panning_scheme`, `right_disconnects` are parsed by
 *    `linterParser.ts` (this renderer's parser only carries what drawing
 *    reads — `types.ts`'s own doc) but have no picture either.
 *  - `connection_lines_antialiased`: `lines_antialiased`'s ONLY reader is
 *    `GraphEditMinimap`'s own simplified polyline draw
 *    (`graph_edit.cpp:1611`) — the main canvas connection shader applies its
 *    OWN fixed pseudo-AA feather unconditionally (`connectionStroke.ts`'s own
 *    doc), so this property has no effect on anything this previewer draws,
 *    the minimap included (already unimplemented toolbar chrome). Not a
 *    render gap — genuinely inert here, same as it is in Godot outside the
 *    minimap.
 *  - `zoom`'s visual scale on a GraphElement's own drawn pixels:
 *    `ControlCanvasWalker.tsx`'s `isFreeParent` gate (`:210-216`) forces
 *    every child of a registered container to scale 1 — `nativeSolver.ts`'s
 *    own doc. A connection endpoint still ports the full `* zoom` formula
 *    (`connectionEndpoints.ts`), so at a non-1 zoom the line lands where
 *    Godot's port actually is, not on this previewer's unscaled node icon —
 *    a visible mismatch between the two, and a known, cited gap outside this
 *    packet's reach rather than something bent to hide it.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`; every grid colour, and every connection colour
 * (`ConnectionLine.tsx`), is composed with it while both are still sRGB,
 * matching every other two-colour chrome in this codebase.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_CONTENT_MARGIN } from '../../../../r3f/controls/godotDefaultTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ControlColor } from '../control/types';
import { computeGridDots, computeGridLines, GRID_PATTERN_DOTS, GRID_PATTERN_LINES, type GridDot, type GridLine } from './grid';
import { resolveGraphEditConnections } from './connectionEndpoints';
import { ConnectionLine } from './ConnectionLine';
import type { GraphEditProperties } from './types';

/** `default_theme.cpp:1287` — `make_flat_stylebox(style_normal_color, 4, 4, 4, 5)`, an asymmetric bottom margin. */
function defaultPanel(theme: NativeControlComponentProps['theme']): StyleBoxFlatData {
  const scale = theme.contentMargin / 4;
  return {
    bgColor: theme.styleFill.normal,
    borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: {
      topLeft: theme.cornerRadius,
      topRight: theme.cornerRadius,
      bottomRight: theme.cornerRadius,
      bottomLeft: theme.cornerRadius,
    },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin: {
      left: Math.round(4 * scale),
      top: Math.round(4 * scale),
      right: Math.round(4 * scale),
      bottom: Math.round(5 * scale),
    },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/** `default_theme.cpp:1293` — `Color(1, 1, 1, 0.05)`. */
const GRID_MINOR_DEFAULT: ControlColor = { r: 1, g: 1, b: 1, a: 0.05 };
/** `default_theme.cpp:1294` — `Color(1, 1, 1, 0.2)`. */
const GRID_MAJOR_DEFAULT: ControlColor = { r: 1, g: 1, b: 1, a: 0.2 };

/** Thickness of one grid LINE, Godot px — `draw_line`'s own default width is a single hairline pixel. */
const LINE_THICKNESS_PX = 1;
/** `graph_edit.cpp:1945,1957` — `Rect2(x - 1, y - 1, 3, 3)`. */
const DOT_SIZE_PX = 3;

function useColorQuad(base: ControlColor, tintOwn: NativeControlComponentProps['tint']['own']) {
  const combined = useMemo(() => multiplyModulate(tintOwn, base), [tintOwn, base]);
  const color = useGodotLinearColor(combined);
  return { color, opacity: combined.a };
}

function GridLineQuad({
  line,
  rect,
  majorColor,
  minorColor,
  renderOrder,
}: {
  line: GridLine;
  rect: { w: number; h: number };
  majorColor: { color: ReturnType<typeof useGodotLinearColor>; opacity: number };
  minorColor: { color: ReturnType<typeof useGodotLinearColor>; opacity: number };
  renderOrder: number;
}) {
  const { color, opacity } = line.major ? majorColor : minorColor;
  const width = line.axis === 'vertical' ? LINE_THICKNESS_PX : rect.w;
  const height = line.axis === 'vertical' ? rect.h : LINE_THICKNESS_PX;
  const x = line.axis === 'vertical' ? line.at : 0;
  const y = line.axis === 'vertical' ? 0 : line.at;
  return (
    <CanvasItemGroup position={[x, -y, 0]}>
      <ControlQuad width={width} height={height} color={color} opacity={opacity} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

function GridDotQuad({
  dot,
  colorQuad,
  renderOrder,
}: {
  dot: GridDot;
  colorQuad: { color: ReturnType<typeof useGodotLinearColor>; opacity: number };
  renderOrder: number;
}) {
  return (
    <CanvasItemGroup position={[dot.x - 1, -(dot.y - 1), 0]}>
      <ControlQuad width={DOT_SIZE_PX} height={DOT_SIZE_PX} color={colorQuad.color} opacity={colorQuad.opacity} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

export function GraphEdit({
  solveNode,
  tint,
  rect,
  theme,
  renderOrder,
  childRects,
  measureText,
}: NativeControlComponentProps) {
  const props = painterView<GraphEditProperties>(solveNode);
  const panelStyle = solveNode.styleBoxes.panel ?? defaultPanel(theme);

  const showGrid = props.showGrid !== false;
  const gridPattern = props.gridPattern ?? GRID_PATTERN_LINES;
  const zoom = props.zoom ?? 1;
  const scrollOffsetX = props.scrollOffset?.x ?? 0;
  const scrollOffsetY = props.scrollOffset?.y ?? 0;
  const snappingDistance = props.snappingDistance ?? 20;
  const scrollOffset = useMemo(() => ({ x: scrollOffsetX, y: scrollOffsetY }), [scrollOffsetX, scrollOffsetY]);

  // `graph_edit.h:253`/`:252` — `lines_curvature = 0.5f`, `lines_thickness = 4.0f`.
  const curvature = props.connectionLinesCurvature ?? 0.5;
  const thickness = props.connectionLinesThickness ?? 4;
  // `_get_shader_line_width` (`graph_edit.cpp:2632-2634`): `lines_thickness * base_scale + 4.0`,
  // `base_scale` recovered from `theme.contentMargin` the same way every other GraphNode/GraphEdit scale is.
  const lineWidth = thickness * (theme.contentMargin / DEFAULT_CONTENT_MARGIN) + 4;
  // `connection_rim_color`'s default is `style_normal_color` (`default_theme.cpp:1301`),
  // the same literal `theme.styleFill.normal` already carries.
  const rimColor = solveNode.colors.connection_rim_color ?? theme.styleFill.normal;
  const connections = useMemo(
    () => resolveGraphEditConnections(solveNode, childRects, props, theme, measureText),
    [solveNode, childRects, props, theme, measureText]
  );

  const majorColor = useColorQuad(solveNode.colors.grid_major ?? GRID_MAJOR_DEFAULT, tint.own);
  const minorColor = useColorQuad(solveNode.colors.grid_minor ?? GRID_MINOR_DEFAULT, tint.own);
  // `transparent_grid_minor.a *= CLAMP(1.0 * (zoom - 0.4), 0, 1)` (graph_edit.cpp:1932).
  const minorDotAlphaFactor = Math.min(1, Math.max(0, zoom - 0.4));
  const minorDotColor = useMemo(
    () => ({ color: minorColor.color, opacity: minorColor.opacity * minorDotAlphaFactor }),
    [minorColor.color, minorColor.opacity, minorDotAlphaFactor]
  );

  const rectSize = useMemo(() => ({ x: rect.w, y: rect.h }), [rect.w, rect.h]);
  const lines = useMemo(
    () => (showGrid && gridPattern !== GRID_PATTERN_DOTS ? computeGridLines(rectSize, scrollOffset, zoom, snappingDistance) : []),
    [showGrid, gridPattern, rectSize, scrollOffset, zoom, snappingDistance]
  );
  const dots = useMemo(
    () =>
      showGrid && gridPattern === GRID_PATTERN_DOTS
        ? computeGridDots(rectSize, scrollOffset, zoom, snappingDistance)
        : { minor: [], major: [] },
    [showGrid, gridPattern, rectSize, scrollOffset, zoom, snappingDistance]
  );

  return (
    <>
      <StyleBoxQuad styleBox={panelStyle} color={tint.own} rect={{ x: 0, y: 0, w: rect.w, h: rect.h }} renderOrder={renderOrder} />

      {lines.map((line, i) => (
        <GridLineQuad key={i} line={line} rect={rect} majorColor={majorColor} minorColor={minorColor} renderOrder={renderOrder} />
      ))}

      {minorDotColor.opacity !== 0 &&
        dots.minor.map((dot, i) => <GridDotQuad key={`m${i}`} dot={dot} colorQuad={minorDotColor} renderOrder={renderOrder} />)}
      {majorColor.opacity !== 0 &&
        dots.major.map((dot, i) => <GridDotQuad key={`M${i}`} dot={dot} colorQuad={majorColor} renderOrder={renderOrder} />)}

      {connections.map((connection, i) => (
        <ConnectionLine
          key={i}
          connection={connection}
          curvature={curvature}
          lineWidth={lineWidth}
          rimColor={rimColor}
          tintOwn={tint.own}
          renderOrder={renderOrder}
        />
      ))}
    </>
  );
}
