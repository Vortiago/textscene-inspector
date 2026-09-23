/**
 * `<GraphNode>`, the native (WebGL canvas) painter for
 * `GraphNode::_notification(NOTIFICATION_DRAW)` (`scene/gui/graph_node.cpp:621-703`)
 * in source order: body panel, titlebar, title text, per-row ports and slot
 * boxes, resizer. Each colour composes with the walker's `tint` in sRGB, as in `PanelChrome`.
 *
 * `selected_slot` has no `ADD_PROPERTY` and only input changes it
 * (`graph_node.cpp:409-538`), so it stays -1 on load and the
 * `slot_index == selected_slot` branch (`:670-683`) never draws.
 *
 * `ControlCanvasWalker` owns `visible`, `children` and the transform.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { Fragment, useMemo } from 'react';
import type * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { multiplyModulate, type RGBA } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  resolveTitleFontTheme,
  shapeTitleText,
  layoutLabelLines,
  titlebarGeometry,
} from '../graphelement/graphTitlebar';
import { soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { GRAPH_PORT_ICON, GRAPH_PORT_ICON_SIZE, RESIZER_SE_ICON, RESIZER_SE_ICON_SIZE } from '../graphelement/graphIcons';
import type { ControlColor } from '../control/types';
import {
  GRAPH_NODE_TITLE_DEFAULT_COLOR,
  GRAPH_NODE_TITLE_VARIATION,
  graphNodeDrawRows,
  graphNodeStyles,
  graphNodeTitleTextMin,
} from './nativeSolver';
import type { GraphNodeProperties } from './types';

interface ImageLike {
  width?: number;
  height?: number;
}

/** Composes `own` (raw sRGB) with a widget's base colour, then converts the result to linear. */
function useTintedColor(own: RGBA, base: ControlColor): { color: THREE.Color; opacity: number } {
  const combined = useMemo(() => multiplyModulate(own, base), [own, base]);
  const color = useGodotLinearColor(combined);
  return { color, opacity: combined.a };
}

interface PortProps {
  solveNode: SolveNode;
  iconRef: string | undefined;
  slotColor: ControlColor;
  tintOwn: RGBA;
  /** Row centre, Godot px, local to the node's own top-left. */
  x: number;
  y: number;
  renderOrder: number;
}

/** One port icon. A dedicated component so its `useTexture2D` call keeps a stable hook count across a dynamic slot count. */
function GraphNodePort({ solveNode, iconRef, slotColor, tintOwn, x, y, renderOrder }: PortProps) {
  const { externalResources, internalResources } = solveNode.resources;
  const custom = useTexture2D(iconRef, externalResources, internalResources);
  const defaultTexture = useNodeIcon(solveNode.icons.port, GRAPH_PORT_ICON);
  const texture = custom.texture ?? defaultTexture;
  const image = custom.texture?.image as ImageLike | undefined;
  const size =
    custom.texture && image?.width && image?.height
      ? { x: image.width, y: image.height }
      : GRAPH_PORT_ICON_SIZE;
  const { color, opacity } = useTintedColor(tintOwn, slotColor);

  return (
    <CanvasItemGroup position={[x - size.x / 2, -(y - size.y / 2), 0]}>
      <ControlQuad width={size.x} height={size.y} color={color} opacity={opacity} map={texture} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

/** `theme_override_constants/port_h_offset`, else `0` (`default_theme.cpp`'s own literal, not scaled). */
function portHOffsetOf(constants: SolveNode['constants']): number {
  return constants.port_h_offset ?? 0;
}

export function GraphNode({ solveNode, tint, rect, theme, renderOrder, childRects }: NativeControlComponentProps) {
  const props = painterView<GraphNodeProperties>(solveNode);
  // `<TextRun>` builds its own material, so it takes the ambient planes as a
  // prop rather than reading them (`nativeClipCoverage.test.tsx`'s own doc).
  const clippingPlanes = useControlClipPlanes();
  const selected = props.selected === true;
  const styles = graphNodeStyles(solveNode, theme);
  const panelStyle = selected ? styles.panelSelected : styles.panel;
  const titlebarStyle = selected ? styles.titlebarSelected : styles.titlebar;

  const textMin = graphNodeTitleTextMin(solveNode, theme);
  const titlebarBand = useMemo(
    () => titlebarGeometry(rect.w, textMin.y, styles.titlebar),
    [rect.w, textMin.y, styles.titlebar]
  );
  const bodyRect = {
    x: 0,
    y: titlebarBand.rect.h,
    w: rect.w,
    h: Math.max(0, rect.h - titlebarBand.rect.h),
  };

  const title = props.title ?? '';
  const fontTheme = useMemo(
    () => resolveTitleFontTheme(solveNode, GRAPH_NODE_TITLE_VARIATION, theme.fontSize, GRAPH_NODE_TITLE_DEFAULT_COLOR),
    [solveNode, theme.fontSize]
  );
  const titleLayout = useMemo(() => (title.length > 0 ? shapeTitleText(title, fontTheme) : null), [title, fontTheme]);
  const titlePlacements = useMemo(
    () =>
      titleLayout
        ? layoutLabelLines(titleLayout, titlebarBand.contentRect.w, titlebarBand.contentRect.h, undefined, undefined)
        : [],
    [titleLayout, titlebarBand.contentRect.w, titlebarBand.contentRect.h]
  );
  const titleLineLayouts = useMemo(
    () => (titleLayout ? titlePlacements.map((p) => soloLineLayout(p.line, titleLayout)) : []),
    [titlePlacements, titleLayout]
  );

  const rows = useMemo(
    () =>
      graphNodeDrawRows(
        solveNode,
        props,
        childRects,
        panelStyle.contentMargin.left,
        rect.w - panelStyle.contentMargin.left - panelStyle.contentMargin.right
      ),
    [solveNode, props, childRects, panelStyle, rect.w]
  );
  const portHOffset = portHOffsetOf(solveNode.constants);

  const titleTintColor = useMemo(() => multiplyModulate(tint.own, fontTheme.color), [tint.own, fontTheme.color]);

  const resizerTexture = useNodeIcon(
    props.resizable === true ? solveNode.icons.resizer : undefined,
    props.resizable === true ? RESIZER_SE_ICON : null
  );
  // `resizer_color`'s default (`default_theme.cpp:800`) is `control_font_color`:
  // the same literal `GRAPH_NODE_TITLE_DEFAULT_COLOR` already names.
  const resizerTint = useTintedColor(tint.own, GRAPH_NODE_TITLE_DEFAULT_COLOR);

  return (
    <>
      {/* `StyleBoxQuad` consumes only the size of the rect it is given (its own
          doc), so a box drawn at an offset inside this control needs that
          offset from the group around it. */}
      <CanvasItemGroup position={[bodyRect.x, -bodyRect.y, 0]}>
        <StyleBoxQuad styleBox={panelStyle} color={tint.own} rect={bodyRect} renderOrder={renderOrder} />
      </CanvasItemGroup>
      <StyleBoxQuad styleBox={titlebarStyle} color={tint.own} rect={titlebarBand.rect} renderOrder={renderOrder} />

      {titleLayout &&
        titlePlacements.map((placement, i) => (
          <CanvasItemGroup
            key={i}
            position={[titlebarBand.contentRect.x + placement.x, -(titlebarBand.contentRect.y + placement.y), 0]}
          >
            <TextRun
              layout={titleLineLayouts[i]!}
              fontSizePx={fontTheme.fontSizePx}
              tint={titleTintColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}

      {rows.map((row) => (
        <Fragment key={row.rawIndex}>
          {row.styleboxRect && (
            <CanvasItemGroup position={[row.styleboxRect.x, -row.styleboxRect.y, 0]}>
              <StyleBoxQuad styleBox={styles.slot} color={tint.own} rect={row.styleboxRect} renderOrder={renderOrder} />
            </CanvasItemGroup>
          )}
          {row.slot.leftEnabled && (
            <GraphNodePort
              solveNode={solveNode}
              iconRef={row.slot.leftIcon}
              slotColor={row.slot.leftColor}
              tintOwn={tint.own}
              x={portHOffset}
              y={row.slotY}
              renderOrder={renderOrder}
            />
          )}
          {row.slot.rightEnabled && (
            <GraphNodePort
              solveNode={solveNode}
              iconRef={row.slot.rightIcon}
              slotColor={row.slot.rightColor}
              tintOwn={tint.own}
              x={rect.w - portHOffset}
              y={row.slotY}
              renderOrder={renderOrder}
            />
          )}
        </Fragment>
      ))}
      {resizerTexture && props.resizable === true && (
        <CanvasItemGroup position={[rect.w - RESIZER_SE_ICON_SIZE.x, -(rect.h - RESIZER_SE_ICON_SIZE.y), 0]}>
          <ControlQuad
            width={RESIZER_SE_ICON_SIZE.x}
            height={RESIZER_SE_ICON_SIZE.y}
            color={resizerTint.color}
            opacity={resizerTint.opacity}
            map={resizerTexture}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
