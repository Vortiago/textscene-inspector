/**
 * `<Button>` — the native (WebGL canvas) painter for `Button`: chrome
 * (a StyleBox drawn across the whole solved rect, unless `flat`), a centred/
 * aligned text label, and an optional icon — Button is the first COMPOSITE
 * native painter (`buttonBase.ts`'s shared logic is what makes this
 * tractable rather than one large ad-hoc component). Draw state comes ONLY
 * from this node's OWN parsed props (`disabled`) — no hover/pressed/focus:
 * a static viewer, not an interactive control.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. `tint.own` (raw sRGB) goes
 * straight to `<StyleBoxQuad>`'s `color` prop for the chrome, and is
 * multiplied per-item into the font and icon colours BEFORE each item's own
 * single sRGB→linear conversion — `PanelChrome.tsx`'s established ordering.
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
 * TEXT LAYOUT: calls `nativeSolver.ts`'s `buttonLabelShape`, the **solve
 * handoff** share the minimum-size solver calls too, so one shaping computes
 * both the box and the glyphs. There is no second spelling of the parameters
 * here to drift from, and no fallback arm a test could exercise instead.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  AutowrapMode,
  clampAutowrapMode,
  shapedTextSizeWidthPx,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { OverrunBehavior, overrunFlagsForBehavior, trimLineToWidth } from '../../../../r3f/controls/native/text/textOverrun';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveButtonDrawState,
  pickButtonStyleBox,
  tintColor,
  layoutButtonContent,
  buttonTextAlignShiftPx,
  swapAlignmentSide,
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  VERTICAL_ALIGNMENT_CENTER,
} from '../../../../r3f/controls/native/buttonBase';
import { BUTTON_THEME_FONT_KEY, buttonLabelShape, buttonTextTheme, buttonIconColor } from './nativeSolver';
import type { ButtonProperties } from './types';

interface IconImageLike {
  width?: number;
  height?: number;
}

export function Button({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<ButtonProperties>(solveNode);
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.button, state, solveNode.rtl);

  const clippingPlanes = useControlClipPlanes();

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = buttonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(
    () => tintColor(baseFontColor, tint.own),
    [baseFontColor, tint.own]
  );

  const fontMetrics = resolveNodeFontMetrics(solveNode, BUTTON_THEME_FONT_KEY);
  // Pass 1, unwrapped: what the icon's own reservation is measured against.
  const unwrapped: TextLayoutResult | null = buttonLabelShape(solveNode, theme);

  // --- Icon: resolve + load the referenced texture -------------------------
  // The node's OWN scope, not the ambient provider's: a Button that arrived
  // through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  // `useTexture2D`, not the path-only resolver: an icon may be an inline
  // procedural texture, which has no path to load from.
  const { texture: iconSource } = useTexture2D(props.icon, externalResources, internalResources);
  // NoColorSpace: the 2D canvas's hardware filter blends undecoded sRGB
  // bytes (`canvas2DTextureDecode.ts`); `ControlQuad` decodes the
  // already-filtered sample once it sees this tag.
  const iconTexture = useCanvas2DTexture(iconSource);

  const iconNaturalSize: Vec2 | null = useMemo(() => {
    if (!props.icon || !iconTexture) return null;
    const image = iconTexture.image as IconImageLike | undefined;
    const w = image?.width ?? 0;
    const h = image?.height ?? 0;
    return w > 0 && h > 0 ? { x: w, y: h } : null;
  }, [props.icon, iconTexture]);

  const baseIconColor = buttonIconColor(solveNode.colors, state);
  const tintedIconColorSrgb = useMemo(
    () => tintColor(baseIconColor, tint.own),
    [baseIconColor, tint.own]
  );
  const iconLinearColor = useGodotLinearColor(tintedIconColorSrgb);

  // --- Content layout: icon + text placement within the solved rect -------
  const contentInput = useMemo(
    () => ({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        hSeparation: solveNode.constants.h_separation ?? theme.separation,
        iconMaxWidth: solveNode.constants.icon_max_width ?? 0,
        textAlignment: props.alignment ?? HORIZONTAL_ALIGNMENT_CENTER,
        iconAlignment: props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT,
        verticalIconAlignment: props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER,
        expandIcon: props.expandIcon === true,
        iconNaturalSize,
        hasText,
        rtl: solveNode.rtl,
        // Godot's draw path reads the same ceiled `text_buf->get_size()` its
        // minimum size does (`scene/gui/button.cpp:343,349`), so the alignment
        // shift is computed against the ceiled width, not the raw pen advance.
        // Only the width needs it: `Size2::ceil()` ceils both components, but
        // the line pitch is already a sum of independently-ceiled ascent and
        // descent plus an integral theme spacing, so the height is integral.
      }),
    [
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      solveNode.constants,
      props.alignment,
      props.iconAlignment,
      props.verticalIconAlignment,
      props.expandIcon,
      iconNaturalSize,
      hasText,
      theme.separation,
      solveNode.rtl,
    ]
  );

  /** `textNaturalSize` as `layoutButtonContent` wants it — the CEILED shaped width Godot's own draw path reads (`button.cpp:343,349`). */
  const naturalSize = (l: TextLayoutResult | null): Vec2 =>
    l ? { x: shapedTextSizeWidthPx(l.widthPx), y: l.heightPx } : { x: 0, y: 0 };

  // `button.cpp:428-432`: a wrapping label is re-shaped at
  // `Math::ceil(MAX(1.0f, drawable_size_remained.width))` — the box the
  // unwrapped pass just measured, since `is_clipped` is true whenever autowrap
  // is on (`:332`) and the icon's reservation therefore does not move with the
  // text. Godot reaches the same state over two frames.
  // `button.cpp:262-276` — the same RTL side swap `layoutButtonContent` makes internally.
  const textAlignment = solveNode.rtl
    ? swapAlignmentSide(props.alignment ?? HORIZONTAL_ALIGNMENT_CENTER)
    : (props.alignment ?? HORIZONTAL_ALIGNMENT_CENTER);
  const wraps = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF) !== AutowrapMode.OFF;
  const drawableWidthPx = layoutButtonContent({
    ...contentInput,
    textNaturalSize: naturalSize(unwrapped),
  }).drawableSize.x;
  const layout: TextLayoutResult | null = wraps
    ? buttonLabelShape(solveNode, theme, Math.ceil(Math.max(1, drawableWidthPx)))
    : unwrapped;
  const content = useMemo(
    () => layoutButtonContent({ ...contentInput, textNaturalSize: naturalSize(layout) }),
    [contentInput, layout]
  );

  // button.cpp:424 `text_buf_width = ceil(MAX(1, drawable_size_remained.width))`
  // — the icon's ALREADY-COMPUTED reservation (`content.icon.rect.w`, unaffected
  // by any trim), never re-derived here, keeps this in step with
  // `layoutButtonContent`'s own icon-fitting math without duplicating it.
  const overrunFlags = useMemo(
    () => overrunFlagsForBehavior(props.overrunBehavior ?? OverrunBehavior.NO_TRIMMING),
    [props.overrunBehavior]
  );
  const trimmedLayout: TextLayoutResult | null = useMemo(() => {
    // A wrapped buffer is trimmed per ROW by the TextServer; this single-line
    // trim would collapse it to its first row, so it stands down there.
    if (!layout || !overrunFlags.trim || layout.lines.length > 1) return layout;
    const customElementWidth = rect.w - baseStyleBox.contentMargin.left - baseStyleBox.contentMargin.right;
    const iconReserve =
      content.icon && (props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT) !== HORIZONTAL_ALIGNMENT_CENTER
        ? content.icon.rect.w + (solveNode.constants.h_separation ?? theme.separation)
        : 0;
    const trimWidthPx = Math.ceil(Math.max(1, customElementWidth - iconReserve));
    const trimmedLine = trimLineToWidth(layout.lines[0]!, trimWidthPx, overrunFlags, { fontMetrics, fontSizePx });
    return soloLineLayout(trimmedLine, layout);
  }, [layout, overrunFlags, rect.w, baseStyleBox.contentMargin, content.icon, props.iconAlignment, solveNode.constants, theme.separation, fontMetrics, fontSizePx]);

  return (
    <>
      {!props.flat && <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />}
      {content.icon && iconTexture && (
        <CanvasItemGroup position={[content.icon.rect.x, -content.icon.rect.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={content.icon.rect.w}
            height={content.icon.rect.h}
            color={iconLinearColor}
            opacity={tintedIconColorSrgb.a}
            map={iconTexture}
          />
        </CanvasItemGroup>
      )}
      {content.text !== null &&
        trimmedLayout &&
        trimmedLayout.lines.map((line, i) => (
          // `TextParagraph::draw` aligns EVERY line inside the paragraph width
          // on its own (`text_paragraph.cpp:887-922`), so a wrapped label's
          // shorter rows re-centre rather than hanging off the widest one.
          // `content.text.offset.x` already carries the widest row's shift, so
          // it is backed out and each row's own put in its place.
          <CanvasItemGroup
            key={i}
            position={[
              content.text!.offset.x -
                buttonTextAlignShiftPx(naturalSize(trimmedLayout).x, content.drawableSize.x, textAlignment) +
                buttonTextAlignShiftPx(
                  shapedTextSizeWidthPx(line.widthPx),
                  content.drawableSize.x,
                  textAlignment
                ),
              -(content.text!.offset.y + i * trimmedLayout.linePitchPx),
              0,
            ]}
          >
            <TextRun
              layout={soloLineLayout(line, trimmedLayout)}
              fontSizePx={fontSizePx}
              tint={tintedFontColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
    </>
  );
}
