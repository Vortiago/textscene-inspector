/**
 * `<CheckBoxNative>` — the native (WebGL canvas) painter for `CheckBox`: a
 * check/radio indicator icon (always drawn, `check_box.cpp::_notification`'s
 * `NOTIFICATION_DRAW` has no visibility gate) followed by the label text —
 * NO StyleBox chrome mesh at all, since CheckBox's own "normal" StyleBox is a
 * `StyleBoxEmpty` (`nativeSolver.ts`'s own doc). This closes the divergence
 * `comparison.md` records: the DOM twin (`Component.tsx`) hand-draws an
 * outlined square/circle because it has no access to the theme's actual icon
 * textures; this painter draws the REAL vendored icons
 * (`native/themeIcons.ts`'s `CHECK_BOX_ICONS`).
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the ambient `Modulate2DContext` it provides AROUND this painter, so this
 * calls `useCanvasItemTint` with `modulate: WHITE_MODULATE` (a no-op) and
 * `self_modulate` from this node's own properties — the same rule
 * `ButtonNative`/`HSplitContainerNative` follow. The icon's OWN modulate is
 * ALWAYS opaque white in the default theme (`checkbox_checked_color`/
 * `checkbox_unchecked_color` both `Color(1,1,1)`, `default_theme.cpp:312-313`)
 * — the disabled dimming is baked into the disabled SVGs' own fill-opacity,
 * not a separate runtime multiply — so the icon quad's colour/opacity are
 * `tint.color`/`tint.opacity` directly, with no extra per-state multiply the
 * way `ButtonNative`'s icon needs one.
 *
 * `renderOrder` reaches both meshes this painter emits (the icon `ControlQuad`
 * and the label `<TextRun>`); `clippingPlanes` reaches the text material
 * explicitly (the icon quad reads `useControlClipPlanes()` internally).
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { CHECK_BOX_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import {
  checkBoxIconMaxWidth,
  checkBoxHSeparation,
  checkBoxCheckVOffset,
  checkBoxTextTheme,
  fitIconSize,
  layoutCheckBoxContent,
  resolveCheckBoxDrawState,
  resolveCheckBoxIconKey,
  tintColor,
  CHECKBOX_ICON_NATURAL_SIZE,
} from './nativeSolver';
import type { CheckBoxProperties } from './types';

export function CheckBoxNative({ solveNode, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = solveNode.node.properties as CheckBoxProperties;
  const state = resolveCheckBoxDrawState(props);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  const clippingPlanes = useControlClipPlanes();

  // --- Icon: always drawn, checked/unchecked (or radio_*) per state --------
  const iconKey = resolveCheckBoxIconKey(props);
  const iconTexture = useIconTexture(CHECK_BOX_ICONS[iconKey]);
  const iconSize = useMemo(() => {
    const fitted = fitIconSize(CHECKBOX_ICON_NATURAL_SIZE, checkBoxIconMaxWidth(props));
    return { x: Math.round(fitted.x), y: Math.round(fitted.y) };
  }, [props]);

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = checkBoxTextTheme(props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const layout: TextLayoutResult | null = useMemo(
    () => (hasText ? shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF }) : null),
    [hasText, text, fontSizePx]
  );

  // --- Content layout: icon + text placement within the solved rect -------
  const content = useMemo(
    () =>
      layoutCheckBoxContent({
        rectSize: { x: rect.w, y: rect.h },
        margin: theme.contentMargin,
        iconSize,
        checkVOffset: checkBoxCheckVOffset(props),
        hSeparation: checkBoxHSeparation(props, { theme }),
        hasText,
        textNaturalSize: layout ? { x: layout.widthPx, y: layout.heightPx } : { x: 0, y: 0 },
        fontSizePx,
      }),
    [rect.w, rect.h, theme, iconSize, props, hasText, layout, fontSizePx]
  );

  return (
    <>
      <group position={[content.iconRect.x, -content.iconRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={content.iconRect.w}
          height={content.iconRect.h}
          color={tint.color}
          opacity={tint.opacity}
          map={iconTexture}
        />
      </group>
      {content.textOffset && layout && (
        <group position={[content.textOffset.x, -content.textOffset.y, 0]}>
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
