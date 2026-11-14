/**
 * `<GraphNode>`, the native (WebGL canvas) painter for `GraphNode::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/graph_node.cpp:621-703`) in source order: body panel, titlebar, per-row ports and slot
 * boxes, resizer. The title is an internal Label (`../graphelement/graphTitlebar.ts`). Each colour
 * composes with the walker's `tint` in sRGB, as in `PanelChrome`, and `ControlCanvasWalker` owns
 * `visible`, `children` and the transform.
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
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useNodeReference } from '../../../../resources/reading';
import { multiplyModulate, useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { titlebarAndBodyRects, titlebarBandHeightChannel } from '../graphelement/graphTitlebar';
import {
  GRAPH_PORT_ICON,
  GRAPH_PORT_ICON_SIZE,
  RESIZER_SE_ICON,
  RESIZER_SE_ICON_SIZE,
} from '../graphelement/graphIcons';
import type { Vector2 } from '../../../../godot/math/vector';
import { scaledIconSizeOf } from '../../../../r3f/controls/native/scaledSvgIcon';
import { graphNodeDrawRows, graphNodeStyles, portHOffsetOf, rightPortX } from './nativeSolver';
import type { GraphNodeProperties } from './types';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { Rgba } from '../../../../godot/math/math';

/** Composes `own` (raw sRGB) with a widget's base colour, then converts the result to linear. */
function useTintedColor(own: Rgba, base: Rgba): { color: THREE.Color; opacity: number } {
  const combined = useMemo(() => multiplyModulate(own, base), [own, base]);
  const color = useItemLinearColor(combined);
  return { color, opacity: combined.a };
}

interface PortProps {
  solveNode: SolveNode;
  /** The default port icon's size at the theme scale, for a port with no icon of its own. */
  defaultSize: Vector2;
  iconRef: string | undefined;
  slotColor: Rgba;
  tintOwn: Rgba;
  /** Row centre, Godot px, local to the node's own top-left. */
  x: number;
  y: number;
  renderOrder: number;
}

/** One port icon. A dedicated component so its `useTexture2D` call keeps a stable hook count across a dynamic slot count. */
function GraphNodePort({
  solveNode,
  defaultSize,
  iconRef,
  slotColor,
  tintOwn,
  x,
  y,
  renderOrder,
}: PortProps) {
  const custom = useTexture2D(useNodeReference(iconRef, solveNode.resources));
  const defaultTexture = useNodeIcon(solveNode.icons.port, GRAPH_PORT_ICON);
  const texture = custom.texture ?? defaultTexture;
  const size = custom.size ? { x: custom.size.width, y: custom.size.height } : defaultSize;
  const { color, opacity } = useTintedColor(tintOwn, slotColor);

  return (
    <PositionedIcon
      rect={{ x: x - size.x / 2, y: y - size.y / 2, w: size.x, h: size.y }}
      texture={texture}
      color={color}
      opacity={opacity}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}

export function GraphNode({
  solveNode,
  tint,
  rect,
  theme,
  renderOrder,
  childRects,
  meta,
}: NativeControlComponentProps) {
  const props = painterView<GraphNodeProperties>(solveNode);
  const selected = props.selected === true;
  const styles = graphNodeStyles(solveNode);
  const portSize = scaledIconSizeOf(GRAPH_PORT_ICON_SIZE, theme.scale);
  const resizerSize = scaledIconSizeOf(RESIZER_SE_ICON_SIZE, theme.scale);
  const panelStyle = selected ? styles.panelSelected : styles.panel;
  const titlebarStyle = selected ? styles.titlebarSelected : styles.titlebar;

  const { titlebar, body: bodyRect } = titlebarAndBodyRects(rect, titlebarBandHeightChannel.open(meta) ?? 0);

  // `selected_slot` has no `ADD_PROPERTY` and only input changes it (`graph_node.cpp:409-538`), so
  // it stays -1 on load and the `slot_index == selected_slot` branch (`:670-683`) never draws.
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

  const resizerTexture = useNodeIcon(
    props.resizable === true ? solveNode.icons.resizer : undefined,
    props.resizable === true ? RESIZER_SE_ICON : null
  );
  const resizerTint = useTintedColor(tint.own, requiredThemeItem(solveNode.colors, 'resizer_color'));

  return (
    <>
      {/* `StyleBoxQuad` consumes only the size of the rect it is given (its own
          doc), so a box drawn at an offset inside this control needs that
          offset from the group around it. */}
      <CanvasItemGroup position={[bodyRect.x, -bodyRect.y, 0]}>
        <StyleBoxQuad styleBox={panelStyle} color={tint.own} rect={bodyRect} renderOrder={renderOrder} />
      </CanvasItemGroup>
      <StyleBoxQuad styleBox={titlebarStyle} color={tint.own} rect={titlebar} renderOrder={renderOrder} />

      {rows.map((row) => (
        <Fragment key={row.rawIndex}>
          {row.styleboxRect && (
            <CanvasItemGroup position={[row.styleboxRect.x, -row.styleboxRect.y, 0]}>
              <StyleBoxQuad
                styleBox={styles.slot}
                color={tint.own}
                rect={row.styleboxRect}
                renderOrder={renderOrder}
              />
            </CanvasItemGroup>
          )}
          {row.slot.leftEnabled && (
            <GraphNodePort
              solveNode={solveNode}
              defaultSize={portSize}
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
              defaultSize={portSize}
              iconRef={row.slot.rightIcon}
              slotColor={row.slot.rightColor}
              tintOwn={tint.own}
              x={rightPortX(rect.w, portHOffset)}
              y={row.slotY}
              renderOrder={renderOrder}
            />
          )}
        </Fragment>
      ))}
      {resizerTexture && props.resizable === true && (
        <PositionedIcon
          rect={{
            x: rect.w - resizerSize.x,
            y: rect.h - resizerSize.y,
            w: resizerSize.x,
            h: resizerSize.y,
          }}
          texture={resizerTexture}
          color={resizerTint.color}
          opacity={resizerTint.opacity}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
    </>
  );
}
