/**
 * `<Button>` — the native (WebGL canvas) painter for `Button`: chrome
 * (a StyleBox drawn across the whole solved rect, unless `flat`), a centred/
 * aligned text label, and an optional icon — Button is the first COMPOSITE
 * native painter (`buttonBase.ts`'s shared logic is what makes this
 * tractable rather than one large ad-hoc component). Draw state comes ONLY
 * from this node's OWN parsed props (`disabled`) — no hover/pressed/focus:
 * a static viewer, not an interactive control.
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the `Modulate2DContext` value it provides AROUND this painter (ancestor ×
 * this node's `modulate`), so re-running `modulate` here would multiply it a
 * SECOND time — the same bug `ColorRect`/`PanelChrome` avoid. This
 * painter therefore calls `useCanvasItemTint` with `modulate: WHITE_MODULATE`
 * (a no-op — the ambient value already carries it) and `self_modulate` from
 * this node's own properties (own-pixels only, never propagated to
 * children). The resulting `tint.own` (raw sRGB) is handed straight to
 * `<StyleBoxQuad>`'s own `color` prop for the chrome, and multiplied,
 * per-item, into the font colour and icon modulate BEFORE each item's own
 * single sRGB→linear conversion — mirroring `PanelChrome.tsx`'s established
 * ordering for its own StyleBox.
 *
 * `renderOrder` is forwarded to EVERY mesh this painter emits: `StyleBoxQuad`,
 * `ControlQuad` (the icon) and `<TextRun>` all take it directly as a prop.
 * `clippingPlanes` likewise reaches every mesh: the two quads read
 * `useControlClipPlanes()` internally, but `<TextRun>` builds its own
 * `ShaderMaterial` and can only be handed the planes explicitly — without that
 * this button's label would escape an enclosing `ScrollContainer`'s clip while
 * its own chrome respected it.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 *
 * TEXT LAYOUT: reads `meta` (`nativeSolver.ts`'s `buttonMinimumSize` — see
 * its own doc) instead of shaping `text` itself. That function already shapes
 * the SAME string at the SAME literal parameters this painter would
 * (`boxWidthPx: 0`, `autowrapMode: OFF`, `lineSpacingPx: 0` — Button never
 * wraps) every time the solve runs, so re-shaping here was pure duplicate
 * work, unconditional on every mount/text/font change. Falls back to shaping
 * locally only when `meta` is not a usable `TextLayoutResult` (a hand-built
 * test props object, or a solve whose measurer was unavailable) — the SAME
 * numbers either way, so the fallback carries no divergence risk the way
 * `HSplitContainer`'s custom-minimum-size fallback does.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveTexture2DPath } from '../../../../resources/SubResourceResolver';
import { useResource } from '../../../../resources/useResource';
import { useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapeText,
  AutowrapMode,
  isTextLayoutResult,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveButtonDrawState,
  pickButtonStyleBox,
  tintColor,
  layoutButtonContent,
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  VERTICAL_ALIGNMENT_CENTER,
} from '../../../../r3f/controls/native/buttonBase';
import { BUTTON_THEME_FONT_KEY, buttonTextTheme, buttonIconColor } from './nativeSolver';
import type { ButtonProperties } from './types';

interface IconImageLike {
  width?: number;
  height?: number;
}

export function Button({ solveNode, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  const props = solveNode.node.properties as ButtonProperties;
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, state);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const clippingPlanes = useControlClipPlanes();

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = buttonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(
    () => tintColor(baseFontColor, tint.own),
    [baseFontColor, tint.own]
  );

  const cachedLayout = isTextLayoutResult(meta) ? meta : null;
  // See Label's own Component.tsx for why this reads INSIDE the render body
  // rather than inside the `useMemo` below.
  const fontMetrics = resolveNodeFontMetrics(solveNode, BUTTON_THEME_FONT_KEY);
  const layout: TextLayoutResult | null = useMemo(() => {
    if (!hasText) return null;
    if (cachedLayout) return cachedLayout;
    return shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics });
  }, [hasText, cachedLayout, text, fontSizePx, fontMetrics]);

  // --- Icon: resolve + load the referenced texture -------------------------
  const { externalResources, internalResources } = useSceneResources();
  const iconPath = resolveTexture2DPath(props.icon, externalResources, internalResources);
  const iconResult = useResource<THREE.Texture>(iconPath ?? '', 'Texture2D');
  // NoColorSpace: the 2D canvas's hardware filter blends undecoded sRGB
  // bytes (`canvas2DTextureDecode.ts`); `ControlQuad` decodes the
  // already-filtered sample once it sees this tag.
  const iconTexture = useCanvas2DTexture(iconResult.value);

  const iconNaturalSize: Vec2 | null = useMemo(() => {
    if (!props.icon || !iconTexture) return null;
    const image = iconTexture.image as IconImageLike | undefined;
    const w = image?.width ?? 0;
    const h = image?.height ?? 0;
    return w > 0 && h > 0 ? { x: w, y: h } : null;
  }, [props.icon, iconTexture]);

  const baseIconColor = buttonIconColor(props, state);
  const tintedIconColorSrgb = useMemo(
    () => tintColor(baseIconColor, tint.own),
    [baseIconColor, tint.own]
  );
  const iconLinearColor = useGodotLinearColor(tintedIconColorSrgb);

  // --- Content layout: icon + text placement within the solved rect -------
  const content = useMemo(
    () =>
      layoutButtonContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        hSeparation: props.themeOverrideConstants?.h_separation ?? theme.separation,
        iconMaxWidth: props.themeOverrideConstants?.icon_max_width ?? 0,
        textAlignment: props.alignment ?? HORIZONTAL_ALIGNMENT_CENTER,
        iconAlignment: props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        verticalIconAlignment: props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER,
        expandIcon: props.expandIcon === true,
        iconNaturalSize,
        hasText,
        textNaturalSize: layout ? { x: layout.widthPx, y: layout.heightPx } : { x: 0, y: 0 },
      }),
    [
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      props.themeOverrideConstants,
      props.alignment,
      props.iconAlignment,
      props.verticalIconAlignment,
      props.expandIcon,
      iconNaturalSize,
      hasText,
      layout,
      theme.separation,
    ]
  );

  return (
    <>
      {!props.flat && <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />}
      {content.icon && iconTexture && (
        <group position={[content.icon.rect.x, -content.icon.rect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={content.icon.rect.w}
            height={content.icon.rect.h}
            color={iconLinearColor}
            opacity={tintedIconColorSrgb.a}
            map={iconTexture}
          />
        </group>
      )}
      {content.text && layout && (
        <group position={[content.text.offset.x, -content.text.offset.y, 0]}>
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </group>
      )}
    </>
  );
}
