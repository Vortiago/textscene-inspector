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
import {
  snappedControlOrigin,
  type ControlDrawTransform,
} from '../../../../r3f/controls/native/controlPixelSnap';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useOptionalIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { SCROLL_HINT_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { type RGBA } from '../../../../r3f/canvasItemModulate';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  scrollContainerScrollBars,
  scrollContainerLayoutChannel,
  type ScrollBarPlacement,
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
    loaded.repeat.set(flipH ? -1 : 1, flipV ? -1 : 1);
    loaded.offset.set(flipH ? 1 : 0, flipV ? 1 : 0);
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


/**
 * A ScrollBar's `ControlDrawTransform`. `_update_scrollbar_position` places the
 * bars through `set_anchor_and_offset` alone, so they carry no rotation, scale
 * or pivot.
 */
const SCROLL_BAR_DRAW_TRANSFORM: ControlDrawTransform = {
  rotation: 0,
  scale: { x: 1, y: 1 },
  pivot: { x: 0, y: 0 },
};

interface ScrollBarChromeProps {
  bar: ScrollBarPlacement;
  track: StyleBoxFlatData;
  grabber: StyleBoxFlatData;
  /** Raw sRGB, which `<StyleBoxQuad>` composes into `track` and `grabber`. */
  color: RGBA;
  /**
   * `subtreeChromeRenderOrder`, the last descendant's key. The bars are
   * `INTERNAL_MODE_BACK` children (`scene/gui/scroll_container.cpp:919,924`) that
   * paint after every descendant, so they sit at fractions below the next sibling.
   */
  chromeRenderOrder: number;
  /** The walker's `gui/common/snap_controls_to_pixels`, the only value correct inside a SubViewport. */
  snapToPixels: boolean;
}

/**
 * One scrollbar's track and grabber. Each bar is its own CanvasItem
 * (`scene/gui/scroll_container.cpp:919,924`), so it snaps through
 * `snappedControlOrigin` apart from the container, while `bar.rect` stays at
 * full precision for the reservation arithmetic.
 */
function ScrollBarChrome({ bar, track, grabber, color, chromeRenderOrder, snapToPixels }: ScrollBarChromeProps) {
  if (!bar.visible) return null;
  const origin = snappedControlOrigin(bar.rect, SCROLL_BAR_DRAW_TRANSFORM, snapToPixels);
  // A group carries the position. `StyleBoxQuad` takes only the size and flips y.
  // The grabber is no node (`scene/gui/scroll_bar.cpp:326-344`): it draws
  // unrounded inside the bar's canvas item and inherits the bar's snap.
  return (
    <CanvasItemGroup position={[origin.x, -origin.y, 0]} renderOrder={chromeRenderOrder + 0.25}>
      <StyleBoxQuad styleBox={track} color={color} rect={bar.rect} renderOrder={chromeRenderOrder + 0.25} />
      <CanvasItemGroup
        position={[bar.grabberRect.x, -bar.grabberRect.y, 0]}
        renderOrder={chromeRenderOrder + 0.5}
      >
        <StyleBoxQuad styleBox={grabber} color={color} rect={bar.grabberRect} renderOrder={chromeRenderOrder + 0.5} />
      </CanvasItemGroup>
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
        <ScrollBarChrome
          bar={layout.horizontal}
          track={theme.widgets.scrollBar.scrollHorizontal}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeRenderOrder={subtreeChromeRenderOrder}
          snapToPixels={snapToPixels}
        />
        <ScrollBarChrome
          bar={layout.vertical}
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeRenderOrder={subtreeChromeRenderOrder}
          snapToPixels={snapToPixels}
        />
        {children}
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}
