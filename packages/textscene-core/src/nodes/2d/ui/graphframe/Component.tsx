/**
 * `<GraphFrame>` — the native (WebGL canvas) painter for `GraphFrame`:
 * `GraphFrame::_notification(NOTIFICATION_DRAW)` (`scene/gui/graph_frame.cpp:93-143`),
 * in source order — body panel (tint-substituted or plain), titlebar, title
 * text, resizer.
 *
 * `tint_color_enabled` does not TINT the panel's existing colours — it
 * REPLACES `bg_color` with `tint_color` outright and sets `border_color` to
 * `selected ? <the untinted default's own border colour> :
 * tint_color.lightened(0.3)` (`:113-124`), building a fresh StyleBox rather
 * than multiplying. A `StyleBoxTexture` panel takes the OTHER branch
 * (`:120-124`), which does multiply: `set_modulate(tint_color)`.
 *
 * With `tint_color_enabled` false the else arm draws `sb_panel_flat` alone
 * (`:126`), so a texture panel is not drawn at all — that is the engine's own
 * behaviour, not a gap here.
 *
 * The resize handle draws only when `resizable && !autoshrink_enabled`
 * (`:133`, mirrored in `get_cursor_shape`, `:84`) — `autoshrink_enabled`
 * defaults `true`, so an unauthored GraphFrame never shows one even with
 * `resizable = true`.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`, composed with each base colour while both are still
 * sRGB (`PanelChrome`'s own pattern).
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
import { isStyleBoxTexture, type ResolvedStyleBox } from '../../../../r3f/controls/native/parseStyleBox';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import type { ControlColor } from '../control/types';
import {
  resolveTitleFontTheme,
  shapeTitleText,
  layoutLabelLines,
  titlebarGeometry,
} from '../graphelement/graphTitlebar';
import { RESIZER_SE_ICON, RESIZER_SE_ICON_SIZE } from '../graphelement/graphIcons';
import {
  GRAPH_FRAME_RESIZER_COLOR,
  GRAPH_FRAME_TITLE_DEFAULT_COLOR,
  GRAPH_FRAME_TITLE_FONT_SIZE_PX,
  GRAPH_FRAME_TITLE_VARIATION,
  graphFrameStyles,
  graphFrameTitleTextMin,
} from './nativeSolver';
import type { GraphFrameProperties } from './types';

/** `Color::lightened` (`core/math/color.cpp`): moves each channel toward white by `amount`. */
function lightened(c: ControlColor, amount: number): ControlColor {
  return { r: c.r + (1 - c.r) * amount, g: c.g + (1 - c.g) * amount, b: c.b + (1 - c.b) * amount, a: c.a };
}

/**
 * `graph_frame.cpp:113-124` — the two tint arms, which do different things.
 *
 * A flat panel has its `bg_color` SUBSTITUTED by `tint_color` and its
 * `border_color` derived from it (`:114-119`); a texture panel is MODULATED by
 * it instead (`:120-124`). Neither is the other, and the engine picks by which
 * kind the theme slot holds.
 */
function tintedPanel(
  base: ResolvedStyleBox,
  tintColor: ControlColor,
  selected: boolean
): ResolvedStyleBox {
  if (isStyleBoxTexture(base)) {
    return { ...base, texture: { ...base.texture, modulateColor: tintColor } };
  }
  return {
    ...base,
    bgColor: tintColor,
    borderColor: selected ? base.borderColor : lightened(tintColor, 0.3),
  };
}

export function GraphFrame({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = painterView<GraphFrameProperties>(solveNode);
  const selected = props.selected === true;
  const styles = graphFrameStyles(solveNode, theme);
  const basePanel = selected ? styles.panelSelected : styles.panel;
  // `:126` — the untinted arm draws the FLAT box alone, so a texture panel
  // with tinting off draws nothing, exactly as the engine does.
  const tinted = props.tintColorEnabled === true;
  const panelStyle = tinted
    ? tintedPanel(basePanel, props.tintColor ?? { r: 0.3, g: 0.3, b: 0.3, a: 0.75 }, selected)
    : basePanel;
  const drawsPanel = tinted || !isStyleBoxTexture(panelStyle);
  const titlebarStyle = styles.titlebar;

  const textMin = graphFrameTitleTextMin(solveNode, theme);
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
    () =>
      resolveTitleFontTheme(
        solveNode,
        GRAPH_FRAME_TITLE_VARIATION,
        GRAPH_FRAME_TITLE_FONT_SIZE_PX,
        GRAPH_FRAME_TITLE_DEFAULT_COLOR
      ),
    [solveNode]
  );
  const titleLayout = useMemo(() => (title.length > 0 ? shapeTitleText(title, fontTheme) : null), [title, fontTheme]);
  const titlePlacements = useMemo(
    () =>
      titleLayout
        ? // `title_label` sets `HORIZONTAL_ALIGNMENT_CENTER` explicitly (`graph_frame.cpp:356`) — alignment 1.
          layoutLabelLines(titleLayout, titlebarBand.contentRect.w, titlebarBand.contentRect.h, 1, undefined)
        : [],
    [titleLayout, titlebarBand.contentRect.w, titlebarBand.contentRect.h]
  );
  const titleLineLayouts = useMemo(
    () => (titleLayout ? titlePlacements.map((p) => soloLineLayout(p.line, titleLayout)) : []),
    [titlePlacements, titleLayout]
  );
  const titleTintColor = useMemo(() => multiplyModulate(tint.own, fontTheme.color), [tint.own, fontTheme.color]);

  // `resizable && !autoshrink_enabled` — `autoshrink_enabled` defaults true (graph_frame.cpp:133).
  const showResizer = props.resizable === true && props.autoshrinkEnabled === false;
  const resizerTexture = useNodeIcon(showResizer ? solveNode.icons.resizer : undefined, showResizer ? RESIZER_SE_ICON : null);
  const resizerCombined = useMemo(() => multiplyModulate(tint.own, GRAPH_FRAME_RESIZER_COLOR), [tint.own]);
  const resizerColor = useGodotLinearColor(resizerCombined);

  return (
    <>
      {drawsPanel && (
        <StyleBoxQuad styleBox={panelStyle} color={tint.own} rect={bodyRect} renderOrder={renderOrder} />
      )}
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
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}

      {resizerTexture && (
        <CanvasItemGroup position={[rect.w - RESIZER_SE_ICON_SIZE.x, -(rect.h - RESIZER_SE_ICON_SIZE.y), 0]}>
          <ControlQuad
            width={RESIZER_SE_ICON_SIZE.x}
            height={RESIZER_SE_ICON_SIZE.y}
            color={resizerColor}
            opacity={resizerCombined.a}
            map={resizerTexture}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
