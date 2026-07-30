/**
 * `<ButtonNative>` — the native (WebGL canvas) painter for `Button`: chrome
 * (a StyleBox drawn across the whole solved rect, unless `flat`), a centred/
 * aligned text label, and an optional icon — Button is the first COMPOSITE
 * native painter (`buttonBase.ts`'s shared logic is what makes this
 * tractable rather than one large ad-hoc component). Draw state comes ONLY
 * from this node's OWN parsed props (`disabled`) — no hover/pressed/focus:
 * `Component.tsx` (the DOM twin) is the feature spec for what's in scope,
 * and it models the identical restriction (a static viewer, not an
 * interactive control).
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the `Modulate2DContext` value it provides AROUND this painter (ancestor ×
 * this node's `modulate`), so re-running `modulate` here would multiply it a
 * SECOND time — the same bug `ColorRectNative`/`PanelChrome` avoid. This
 * painter therefore calls `useCanvasItemTint` with `modulate: WHITE_MODULATE`
 * (a no-op — the ambient value already carries it) and `self_modulate` from
 * this node's own properties (own-pixels only, never propagated to
 * children). The resulting `tint.own` (raw sRGB) is then multiplied,
 * per-item, into whichever base colour each of the three draw calls uses
 * (StyleBox fill/border, font colour, icon modulate) BEFORE that item's own
 * single sRGB→linear conversion — mirroring `PanelChrome.tsx`'s established
 * ordering for its own StyleBox, just applied three times here instead of
 * once.
 *
 * `renderOrder` is forwarded to EVERY mesh this painter emits: `StyleBoxQuad`
 * and `ControlQuad` (the icon) both take it directly as a prop; `<TextRun>`
 * has no such prop (it lives in `native/text/**`, out of this packet's
 * ownership), so its wrapping `<group renderOrder={renderOrder}>` carries it
 * instead — three.js propagates a `Group`'s own `renderOrder` down to every
 * descendant mesh's paint-order comparison (`Object3D.js`'s `projectObject`),
 * so this is not a workaround, it is the SAME mechanism `StyleBoxQuad`/
 * `ControlQuad`'s own per-mesh prop uses, just applied one level up.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveTexture2DPath } from '../../../../resources/SubResourceResolver';
import { useResource } from '../../../../resources/useResource';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveButtonDrawState,
  pickButtonStyleBox,
  tintStyleBox,
  tintColor,
  layoutButtonContent,
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  VERTICAL_ALIGNMENT_CENTER,
} from '../../../../r3f/controls/native/buttonBase';
import { buttonTextTheme, buttonIconColor } from './nativeSolver';
import type { ButtonProperties } from './types';

interface IconImageLike {
  width?: number;
  height?: number;
}

export function ButtonNative({ solveNode, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = solveNode.node.properties as ButtonProperties;
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, state);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const styleBox = useMemo(() => tintStyleBox(baseStyleBox, tint.own), [baseStyleBox, tint.own]);

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = buttonTextTheme(props, state, { theme });
  const tintedFontColor = useMemo(
    () => tintColor(baseFontColor, tint.own),
    [baseFontColor, tint.own]
  );

  const layout: TextLayoutResult | null = useMemo(
    () => (hasText ? shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF }) : null),
    [hasText, text, fontSizePx]
  );

  // --- Icon: resolve + load the referenced texture -------------------------
  const { externalResources, internalResources } = useSceneResources();
  const iconPath = resolveTexture2DPath(props.icon, externalResources, internalResources);
  const iconResult = useResource<THREE.Texture>(iconPath ?? '', 'Texture2D');
  const iconTexture = iconResult.value;

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
        styleMargin: styleBox.contentMargin,
        hSeparation: props.themeOverrideConstants?.h_separation ?? theme.separation,
        iconMaxWidth: props.themeOverrideConstants?.icon_max_width ?? 0,
        textAlignment: props.alignment ?? HORIZONTAL_ALIGNMENT_CENTER,
        iconAlignment: props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        verticalIconAlignment: props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER,
        expandIcon: props.expandIcon === true,
        iconNaturalSize,
        hasText,
        textNaturalSize: layout ? { x: layout.widthPx, y: layout.heightPx } : { x: 0, y: 0 },
        fontSizePx,
      }),
    [
      rect.w,
      rect.h,
      styleBox.contentMargin,
      props.themeOverrideConstants,
      props.alignment,
      props.iconAlignment,
      props.verticalIconAlignment,
      props.expandIcon,
      iconNaturalSize,
      hasText,
      layout,
      fontSizePx,
      theme.separation,
    ]
  );

  return (
    <>
      {!props.flat && <StyleBoxQuad styleBox={styleBox} rect={rect} renderOrder={renderOrder} />}
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
            renderOrder={renderOrder}
          />
        </group>
      )}
    </>
  );
}
