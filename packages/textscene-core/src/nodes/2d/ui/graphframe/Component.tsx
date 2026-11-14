/**
 * `<GraphFrame>`, the native (WebGL canvas) painter for `GraphFrame::_notification(NOTIFICATION_DRAW)`
 * (`scene/gui/graph_frame.cpp:93-143`) in source order: body panel, titlebar, resizer. The title is an
 * internal Label (`../graphelement/graphTitlebar.ts`).
 * The walker's `tint` composes with each base colour in sRGB, as in `PanelChrome`, and
 * `ControlCanvasWalker` owns `visible`, `children` and the transform.
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
import { isStyleBoxTexture, type ResolvedStyleBox } from '../../../../r3f/controls/native/parseStyleBox';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { multiplyModulate, useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { titlebarBandHeightChannel, titlebarRect } from '../graphelement/graphTitlebar';
import { RESIZER_SE_ICON, RESIZER_SE_ICON_SIZE } from '../graphelement/graphIcons';
import { scaledIconSizeOf } from '../../../../r3f/controls/native/scaledSvgIcon';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { GraphFrameProperties } from './types';
import { graphElementStyles } from '../graphelement/graphElementStyles';
import { lightened } from '../../../../godot/math/color';
import type { Rgba } from '../../../../godot/math/math';

/**
 * The two tint arms (`graph_frame.cpp:113-124`), picked by the theme slot's kind.
 * A flat panel gets a fresh StyleBox: `bg_color` becomes `tint_color`, and
 * `border_color` keeps the untinted border when selected, else
 * `tint_color.lightened(0.3)` (`:114-119`). A texture panel is modulated (`:120-124`).
 */
function tintedPanel(base: ResolvedStyleBox, tintColor: Rgba, selected: boolean): ResolvedStyleBox {
  if (isStyleBoxTexture(base)) {
    return { ...base, texture: { ...base.texture, modulateColor: tintColor } };
  }
  return {
    ...base,
    bgColor: tintColor,
    borderColor: selected ? base.borderColor : lightened(tintColor, 0.3),
  };
}

export function GraphFrame({ solveNode, tint, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<GraphFrameProperties>(solveNode);
  const selected = props.selected === true;
  const styles = graphElementStyles(solveNode);
  const resizerSize = scaledIconSizeOf(RESIZER_SE_ICON_SIZE, theme.scale);
  const basePanel = selected ? styles.panelSelected : styles.panel;
  // `:126`: the untinted arm draws `sb_panel_flat` alone, so a texture panel
  // with tinting off draws nothing, as in the engine.
  const tinted = props.tintColorEnabled === true;
  const panelStyle = tinted
    ? tintedPanel(basePanel, props.tintColor ?? { r: 0.3, g: 0.3, b: 0.3, a: 0.75 }, selected)
    : basePanel;
  const drawsPanel = tinted || !isStyleBoxTexture(panelStyle);
  const titlebarStyle = styles.titlebar;

  const titlebar = titlebarRect(rect.w, titlebarBandHeightChannel.open(meta) ?? 0);
  const bodyRect = { x: 0, y: titlebar.h, w: rect.w, h: Math.max(0, rect.h - titlebar.h) };

  // `resizable && !autoshrink_enabled` (graph_frame.cpp:133, and `get_cursor_shape` at `:84`):
  // `autoshrink_enabled` defaults true, so `resizable = true` alone shows no handle.
  const showResizer = props.resizable === true && props.autoshrinkEnabled === false;
  const resizerTexture = useNodeIcon(
    showResizer ? solveNode.icons.resizer : undefined,
    showResizer ? RESIZER_SE_ICON : null
  );
  const resizerCombined = useMemo(
    () => multiplyModulate(tint.own, requiredThemeItem(solveNode.colors, 'resizer_color')),
    [tint.own, solveNode.colors]
  );
  const resizerColor = useItemLinearColor(resizerCombined);

  return (
    <>
      {/* `StyleBoxQuad` consumes only the size of the rect it is given (its own
          doc), so a box drawn at an offset inside this control needs that
          offset from the group around it. */}
      {drawsPanel && (
        <CanvasItemGroup position={[bodyRect.x, -bodyRect.y, 0]}>
          <StyleBoxQuad styleBox={panelStyle} color={tint.own} rect={bodyRect} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
      <StyleBoxQuad styleBox={titlebarStyle} color={tint.own} rect={titlebar} renderOrder={renderOrder} />

      {resizerTexture && (
        <PositionedIcon
          rect={{
            x: rect.w - resizerSize.x,
            y: rect.h - resizerSize.y,
            w: resizerSize.x,
            h: resizerSize.y,
          }}
          texture={resizerTexture}
          color={resizerColor}
          opacity={resizerCombined.a}
          renderOrder={renderOrder}
          canvasKey={renderOrder}
        />
      )}
    </>
  );
}
