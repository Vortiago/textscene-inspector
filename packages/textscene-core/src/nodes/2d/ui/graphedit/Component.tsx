/**
 * The native painter for `GraphEdit`: `_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/graph_edit.cpp:853-865`) draws the panel and the grid, then each resolvable
 * connection (`_update_connections`, `:1614-1660`). `panel_focus` is never drawn: a static
 * preview never has focus.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { ControlClipProvider, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { HAIRLINE_THICKNESS_PX, hairlineQuadStartPx } from '../../../../r3f/controls/native/hairline';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate, useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import {
  computeGridDots,
  computeGridLines,
  GRID_PATTERN_DOTS,
  GRID_PATTERN_LINES,
  type GridDot,
  type GridLine,
} from './grid';
import { resolveGraphEditConnections } from './connectionEndpoints';
import { ConnectionLine } from './ConnectionLine';
import { graphEditTopLayerSlots } from './internalControls';
import {
  CONSTRUCTOR_SCROLL_BOUNDS,
  graphEditElements,
  isMinimapEnabled,
  minimapOpacity,
  minimapRect,
  minimapTransform,
} from './minimap';
import { GraphEditMinimapChrome } from './MinimapChrome';
import { minimapConnectionsOf } from './minimapConnections';
import { internalScrollBarBoxes } from '../shared/scrollBarBoxes';
import { graphEditConstructorScrollBars, graphEditScrollBars, hasUpdatedScrollBars } from './scrollBars';
import { ScrollBarChrome } from '../shared/ScrollChrome';
import type { GraphEditProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';
import { themeItemsOfType, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { useStableVector2 } from '../../../../r3f/hooks/useStableVector2';
import { shaderLineWidth } from './connectionStroke';

/** `graph_edit.cpp:1945,1957`: `Rect2(x - 1, y - 1, 3, 3)`. */
const DOT_SIZE_PX = 3;

/** Grid and connection colours take the tint while both are sRGB, before the one linear conversion. */
function useColorQuad(base: Rgba, tintOwn: NativeControlComponentProps['tint']['own']) {
  const combined = useMemo(() => multiplyModulate(tintOwn, base), [tintOwn, base]);
  const color = useItemLinearColor(combined);
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
  majorColor: { color: ReturnType<typeof useItemLinearColor>; opacity: number };
  minorColor: { color: ReturnType<typeof useItemLinearColor>; opacity: number };
  renderOrder: number;
}) {
  const { color, opacity } = line.major ? majorColor : minorColor;
  const width = line.axis === 'vertical' ? HAIRLINE_THICKNESS_PX : rect.w;
  const height = line.axis === 'vertical' ? rect.h : HAIRLINE_THICKNESS_PX;
  const x = line.axis === 'vertical' ? hairlineQuadStartPx(line.at) : 0;
  const y = line.axis === 'vertical' ? 0 : hairlineQuadStartPx(line.at);
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
  colorQuad: { color: ReturnType<typeof useItemLinearColor>; opacity: number };
  renderOrder: number;
}) {
  return (
    <CanvasItemGroup position={[dot.x - 1, -(dot.y - 1), 0]}>
      <ControlQuad
        width={DOT_SIZE_PX}
        height={DOT_SIZE_PX}
        color={colorQuad.color}
        opacity={colorQuad.opacity}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}

export function GraphEdit({
  solveNode,
  tint,
  childTint,
  rect,
  theme,
  renderOrder,
  chromeSlot,
  layerSlot,
  childRects,
  measureText,
  snapToPixels,
  children,
}: NativeControlComponentProps) {
  const props = painterView<GraphEditProperties>(solveNode);
  const panelStyle = requiredThemeItem(solveNode.styleBoxes, 'panel');

  const showGrid = props.showGrid !== false;
  const gridPattern = props.gridPattern ?? GRID_PATTERN_LINES;
  const zoom = props.zoom ?? 1;
  const scrollOffsetX = props.scrollOffset?.x ?? 0;
  const scrollOffsetY = props.scrollOffset?.y ?? 0;
  const snappingDistance = props.snappingDistance ?? 20;
  const scrollOffset = useMemo(
    () => ({ x: scrollOffsetX, y: scrollOffsetY }),
    [scrollOffsetX, scrollOffsetY]
  );

  // `graph_edit.h:253`/`:252`: `lines_curvature = 0.5f`, `lines_thickness = 4.0f`.
  const curvature = props.connectionLinesCurvature ?? 0.5;
  const thickness = props.connectionLinesThickness ?? 4;
  const lineWidth = shaderLineWidth(thickness, theme.scale);
  const rimColor = requiredThemeItem(solveNode.colors, 'connection_rim_color');
  // An endpoint keeps the full `* zoom` (`connectionEndpoints.ts`), as the walker scales each
  // GraphElement child by `zoom`.
  const connections = useMemo(
    () => resolveGraphEditConnections(solveNode, childRects, props, theme, measureText),
    [solveNode, childRects, props, theme, measureText]
  );

  const majorColor = useColorQuad(requiredThemeItem(solveNode.colors, 'grid_major'), tint.own);
  const minorColor = useColorQuad(requiredThemeItem(solveNode.colors, 'grid_minor'), tint.own);
  // `transparent_grid_minor.a *= CLAMP(1.0 * (zoom - 0.4), 0, 1)` (graph_edit.cpp:1932).
  const minorDotAlphaFactor = Math.min(1, Math.max(0, zoom - 0.4));
  const minorDotColor = useMemo(
    () => ({ color: minorColor.color, opacity: minorColor.opacity * minorDotAlphaFactor }),
    [minorColor.color, minorColor.opacity, minorDotAlphaFactor]
  );

  const rectSize = useStableVector2({ x: rect.w, y: rect.h });
  const lines = useMemo(
    () =>
      showGrid && gridPattern !== GRID_PATTERN_DOTS
        ? computeGridLines(rectSize, scrollOffset, zoom, snappingDistance)
        : [],
    [showGrid, gridPattern, rectSize, scrollOffset, zoom, snappingDistance]
  );
  const dots = useMemo(
    () =>
      showGrid && gridPattern === GRID_PATTERN_DOTS
        ? computeGridDots(rectSize, scrollOffset, zoom, snappingDistance)
        : { minor: [], major: [] },
    [showGrid, gridPattern, rectSize, scrollOffset, zoom, snappingDistance]
  );

  const minimapEnabled = isMinimapEnabled(props);
  const graphEditSize = rectSize;
  const elements = graphEditElements(solveNode, childRects, zoom, graphEditSize);
  const { hasPositionedChild, minimapElements } = elements;
  // Until `_update_scrollbars` runs, both bars keep the constructor range and the minimap reads
  // zero bounds (`scrollBars.ts`).
  const hasUpdatedBars = hasUpdatedScrollBars({
    hasGraphElement: elements.hasGraphElement,
    queuedScrollOffsetUpdate: props.queuedScrollOffsetUpdate === true,
    outOfTreeSize: props.outOfTreeSize ?? graphEditSize,
    solvedSize: graphEditSize,
  });
  const bounds = hasUpdatedBars ? elements.bounds : CONSTRUCTOR_SCROLL_BOUNDS;
  const scrollBarBoxes = internalScrollBarBoxes(solveNode);
  const scrollBars = hasUpdatedBars
    ? graphEditScrollBars(graphEditSize, bounds, scrollOffset, scrollBarBoxes)
    : graphEditConstructorScrollBars(graphEditSize, scrollBarBoxes);
  const topLayer = graphEditTopLayerSlots(chromeSlot);
  const minimapPanelRect = minimapRect(graphEditSize, props);
  const minimapXform = minimapTransform({ x: minimapPanelRect.w, y: minimapPanelRect.h }, bounds);

  // The constructor calls `set_clip_contents(true)` (`graph_edit.cpp:3342`), so every GraphEdit
  // clips its chrome and children. The load-time clamp of `set_scroll_offset` (`loadOrder.ts`)
  // often parks the whole graph outside the rect.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  // The walker hands the children over (`wrapsChildren`): the clip reaches them only inside the provider.
  const { anchorRef, clip } = useWorldClipPlanes(ownRect);

  return (
    <CanvasItemGroup ref={anchorRef}>
      {/* The panel and the grid are the item's own pixels. The connections, the bars and the minimap are child Controls, and the toolbar an internal Control (`graph_edit.cpp:3183-3329`): no `self_modulate`. */}
      <ControlClipProvider value={clip}>
        <StyleBoxQuad
          styleBox={panelStyle}
          color={tint.own}
          rect={{ x: 0, y: 0, w: rect.w, h: rect.h }}
          renderOrder={renderOrder}
        />

        {lines.map((line, i) => (
          <GridLineQuad
            key={i}
            line={line}
            rect={rect}
            majorColor={majorColor}
            minorColor={minorColor}
            renderOrder={renderOrder}
          />
        ))}

        {minorDotColor.opacity !== 0 &&
          dots.minor.map((dot, i) => (
            <GridDotQuad key={`m${i}`} dot={dot} colorQuad={minorDotColor} renderOrder={renderOrder} />
          ))}
        {majorColor.opacity !== 0 &&
          dots.major.map((dot, i) => (
            <GridDotQuad key={`M${i}`} dot={dot} colorQuad={majorColor} renderOrder={renderOrder} />
          ))}

        <CanvasItemGroup renderOrder={layerSlot.key}>
          {connections.map((connection, i) => (
            <ConnectionLine
              key={i}
              connection={connection}
              curvature={curvature}
              lineWidth={lineWidth}
              rimColor={rimColor}
              tintOwn={childTint.own}
              renderOrder={layerSlot.key}
            />
          ))}
        </CanvasItemGroup>

        {children}

        <ScrollBarChrome
          bar={scrollBars.horizontal}
          boxes={scrollBarBoxes.horizontal}
          color={childTint.own}
          chromeSlot={topLayer.scrollBars}
          snapToPixels={snapToPixels}
        />
        <ScrollBarChrome
          bar={scrollBars.vertical}
          boxes={scrollBarBoxes.vertical}
          color={childTint.own}
          chromeSlot={topLayer.scrollBars}
          snapToPixels={snapToPixels}
        />

        {minimapEnabled && (
          <GraphEditMinimapChrome
            rect={minimapPanelRect}
            transform={minimapXform}
            bounds={bounds}
            elements={minimapElements}
            zoom={zoom}
            scrollOffset={scrollOffset}
            graphEditSize={graphEditSize}
            opacity={minimapOpacity(props)}
            connections={minimapConnectionsOf(connections, props, hasPositionedChild)}
            curvature={curvature}
            connectionLinesAntialiased={props.connectionLinesAntialiased !== false}
            icons={solveNode.icons}
            items={themeItemsOfType(solveNode, 'GraphEditMinimap')}
            theme={theme}
            tint={childTint}
            slot={topLayer.minimap}
          />
        )}
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}
