/**
 * The native (WebGL canvas) painter for `ScrollContainer`: it clips its
 * subtree through `ControlClipContext` and draws the themed scrollbars and
 * scroll hints. `scene/gui/scroll_bar.cpp` has no autohide gate on a grabber.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { createSolveContext } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { ControlClipProvider, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useOptionalIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { SCROLL_HINT_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { applyUvWindow, flippedUvWindow, FULL_UV_WINDOW } from '../../../../r3f/uvWindow';
import {
  ScrollBarChrome,
  SCROLL_BAR_GRABBER_RENDER_ORDER_OFFSET,
  SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET,
} from '../shared/ScrollBarChrome';
import {
  scrollContainerScrollBars,
  scrollContainerLayoutChannel,
  type ScrollHintPlacement,
} from './nativeSolver';

/**
 * `scroll_hint_vertical_color` and `scroll_hint_horizontal_color`: `Color(0, 0, 0)`
 * (`default_theme.cpp:669-670`), set as the hint's `modulate`
 * (`scroll_container.cpp:622,631,640,650`). Only the texture's alpha ramp shows.
 */
const SCROLL_HINT_MODULATE = new THREE.Color(0, 0, 0);

/**
 * The hints draw above every descendant and below both scrollbars, the order
 * of `scroll_container.cpp:905-924`. A bare `chromeRenderOrder` would tie with
 * the topmost descendant, and three would put the fade under an opaque child.
 */
const SCROLL_HINT_RENDER_ORDER_OFFSET = 0.125;

/**
 * One visible `scroll_hint_*` TextureRect, stretched across its rect as one
 * quad (`scroll_container.cpp:905-912`). `STRETCH_TILE` (`:751-752`) draws the
 * same pixels, since each gradient is uniform along its tiling axis.
 */
function ScrollHintChrome({
  hint,
  color,
  opacity,
  chromeRenderOrder,
}: {
  hint: ScrollHintPlacement | null;
  color: THREE.Color;
  opacity: number;
  chromeRenderOrder: number;
}) {
  const loaded = useOptionalIconTexture(
    hint === null ? null : hint.vertical ? SCROLL_HINT_ICONS.vertical : SCROLL_HINT_ICONS.horizontal
  );
  // `set_flip_h`/`set_flip_v` (`:629-630,647-648`) become a negative UV repeat.
  // Each hook instance has its own texture, so the two hints never share a flip.
  const flipH = hint?.flipH === true;
  const flipV = hint?.flipV === true;
  // A memo, not an effect: three refreshes `mapTransform` only when the
  // material changes, so a flip applied after mount never reaches the GPU.
  const texture = useMemo(() => {
    if (!loaded) return null;
    applyUvWindow(loaded, flippedUvWindow(FULL_UV_WINDOW, flipH, flipV));
    return loaded;
  }, [loaded, flipH, flipV]);

  if (!hint || !texture) return null;
  const renderOrder = chromeRenderOrder + SCROLL_HINT_RENDER_ORDER_OFFSET;
  return (
    <CanvasItemGroup position={[hint.rect.x, -hint.rect.y, 0]} renderOrder={renderOrder}>
      <ControlQuad
        renderOrder={renderOrder}
        width={hint.rect.w}
        height={hint.rect.h}
        color={color}
        opacity={opacity}
        map={texture}
      />
    </CanvasItemGroup>
  );
}

export function ScrollContainer({
  solveNode,
  tint,
  rect,
  subtreeChromeRenderOrder,
  theme,
  snapToPixels,
  children,
  meta,
}: NativeControlComponentProps) {
  const cachedLayout = scrollContainerLayoutChannel.open(meta) ?? null;
  // Fallback when no layout is sealed: a fresh SolveContext on the real
  // solve's theme and measurer. `solveNode` busts its path-keyed minimum-size
  // cache, so a child whose texture arrives later is not measured stale.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const solveCtx = useMemo(() => createSolveContext(theme, measureText), [theme, solveNode]);
  const layout = useMemo(
    () => cachedLayout ?? scrollContainerScrollBars(solveNode, solveCtx, rect),
    [cachedLayout, solveNode, solveCtx, rect]
  );

  // `Control::clip_contents` clips to `Rect2(Point2(), get_size())`, never reduced
  // by a scrollbar (`scroll_container.cpp`'s constructor: child and focus border
  // share one clip). The origin is whole-pixel snapped and the size is not,
  // which is the pair the scissor reads.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clip } = useWorldClipPlanes(ownRect);

  // The hint's `modulate` composed onto the walker's tint, in the order
  // `<StyleBoxQuad>` composes a fill.
  const hintColor = useMemo(() => tint.color.clone().multiply(SCROLL_HINT_MODULATE), [tint.color]);

  return (
    <CanvasItemGroup ref={anchorRef}>
      <ControlClipProvider value={clip}>
        <ScrollHintChrome
          hint={layout.hints.topLeft}
          color={hintColor}
          opacity={tint.opacity}
          chromeRenderOrder={subtreeChromeRenderOrder}
        />
        <ScrollHintChrome
          hint={layout.hints.bottomRight}
          color={hintColor}
          opacity={tint.opacity}
          chromeRenderOrder={subtreeChromeRenderOrder}
        />
        {/* `INTERNAL_MODE_BACK` children (`scroll_container.cpp:919,924`): the bars paint after every descendant. */}
        <ScrollBarChrome
          bar={layout.horizontal}
          track={theme.widgets.scrollBar.scrollHorizontal}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          renderOrder={subtreeChromeRenderOrder + SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET}
          grabberRenderOrder={subtreeChromeRenderOrder + SCROLL_BAR_GRABBER_RENDER_ORDER_OFFSET}
          snapToPixels={snapToPixels}
        />
        <ScrollBarChrome
          bar={layout.vertical}
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          renderOrder={subtreeChromeRenderOrder + SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET}
          grabberRenderOrder={subtreeChromeRenderOrder + SCROLL_BAR_GRABBER_RENDER_ORDER_OFFSET}
          snapToPixels={snapToPixels}
        />
        {children}
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}
