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
import { DEFAULT_CONTENT_MARGIN } from '../../../../godot/scene/theme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
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
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { formatGodotNumber, rangeStepDecimals } from '../spinbox/nativeSolver';
import { graphEditToolbar, zoomLabelText } from './toolbar';
import { GraphEditToolbarChrome } from './ToolbarChrome';
import { graphEditToolbarTheme } from './toolbarTheme';
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
import { graphEditConstructorScrollBars, graphEditScrollBars, hasUpdatedScrollBars } from './scrollBars';
import { ScrollBarChrome } from '../shared/ScrollChrome';
import { canvasSubOrders } from '../../../../r3f/canvasItemState';
import type { GraphEditProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';
import { useStableVector2 } from '../../../../r3f/hooks/useStableVector2';

/** `default_theme.cpp:1287`: `make_flat_stylebox(style_normal_color, 4, 4, 4, 5)`, with a larger bottom margin. */
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

/** `default_theme.cpp:1293`: `Color(1, 1, 1, 0.05)`. */
const GRID_MINOR_DEFAULT: Rgba = { r: 1, g: 1, b: 1, a: 0.05 };
/** `default_theme.cpp:1294`: `Color(1, 1, 1, 0.2)`. */
const GRID_MAJOR_DEFAULT: Rgba = { r: 1, g: 1, b: 1, a: 0.2 };

/** Every internal Label and LineEdit reads the plain "font" theme key, as `Label` and `Button` do. */
const GRAPH_EDIT_THEME_FONT_KEY = 'font';

/** `snapping_distance_spinbox->set_step(1)` (`graph_edit.cpp:3292`): the digit budget of `_update_text`. */
const SNAPPING_SPINBOX_STEP = 1;

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

/**
 * The pieces of `top_layer`, an `INTERNAL_MODE_BACK` child drawn after every GraphElement
 * (`graph_edit.cpp:3183`), in its child order (`:3211-3329`).
 */
const GRAPH_EDIT_TOP_LAYER = ['scrollBars', 'toolbar', 'minimap'] as const;

export function GraphEdit({
  solveNode,
  tint,
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
  const panelStyle = solveNode.styleBoxes.panel ?? defaultPanel(theme);

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
  // `_get_shader_line_width` (`graph_edit.cpp:2632-2634`): `lines_thickness * base_scale + 4.0`,
  // with `base_scale` recovered from `theme.contentMargin`.
  const lineWidth = thickness * (theme.contentMargin / DEFAULT_CONTENT_MARGIN) + 4;
  // The default `connection_rim_color` is `style_normal_color` (`default_theme.cpp:1301`),
  // which `theme.styleFill.normal` holds.
  const rimColor = solveNode.colors.connection_rim_color ?? theme.styleFill.normal;
  // An endpoint keeps the full `* zoom` (`connectionEndpoints.ts`), as the walker scales each
  // GraphElement child by `zoom`.
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

  // Read in the render body, not a `useMemo` (`Label`'s `Component.tsx` says why).
  const fontMetrics = resolveNodeFontMetrics(solveNode, GRAPH_EDIT_THEME_FONT_KEY);
  const layoutCache = useMemo(() => new Map<string, TextLayoutResult>(), []);
  const shape = (text: string): TextLayoutResult => {
    let layout = layoutCache.get(text);
    if (!layout) {
      layout = shapeButtonLabel(text, { fontSizePx: theme.fontSize, fontMetrics });
      layoutCache.set(text, layout);
    }
    return layout;
  };
  const toolbarTheme = graphEditToolbarTheme(solveNode, theme);
  const toolbar = graphEditToolbar(props, theme, toolbarTheme, {
    measure: (text) => {
      const l = shape(text);
      return { x: shapedTextSizeWidthPx(l.widthPx), y: l.heightPx };
    },
    emSpaceWidthPx: shape('W').widthPx,
    fontHeightPx: getFontLinePitchPx(fontMetrics, theme.fontSize, 0),
  });
  const toolbarText = {
    zoomLabel: zoomLabelText(zoom),
    snappingDistance: formatGodotNumber(snappingDistance, rangeStepDecimals(SNAPPING_SPINBOX_STEP)),
  };

  const minimapEnabled = isMinimapEnabled(props);
  const graphEditSize = rectSize;
  const elements = graphEditElements(solveNode, childRects, zoom, graphEditSize, theme);
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
  const scrollBars = hasUpdatedBars
    ? graphEditScrollBars(graphEditSize, bounds, scrollOffset, theme)
    : graphEditConstructorScrollBars(graphEditSize, theme);
  const topLayer = canvasSubOrders(chromeSlot, GRAPH_EDIT_TOP_LAYER);
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
              tintOwn={tint.own}
              renderOrder={layerSlot.key}
            />
          ))}
        </CanvasItemGroup>

        {children}

        <ScrollBarChrome
          bar={scrollBars.horizontal}
          track={theme.widgets.scrollBar.scrollHorizontal}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeSlot={topLayer.scrollBars}
          snapToPixels={snapToPixels}
        />
        <ScrollBarChrome
          bar={scrollBars.vertical}
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeSlot={topLayer.scrollBars}
          snapToPixels={snapToPixels}
        />

        {toolbar && (
          <GraphEditToolbarChrome
            toolbar={toolbar}
            items={toolbarTheme}
            icons={solveNode.icons}
            theme={theme}
            tint={tint}
            text={toolbarText}
            shape={shape}
            rtl={solveNode.rtl}
            slot={topLayer.toolbar}
          />
        )}

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
            theme={theme}
            tint={tint}
            slot={topLayer.minimap}
          />
        )}
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}
