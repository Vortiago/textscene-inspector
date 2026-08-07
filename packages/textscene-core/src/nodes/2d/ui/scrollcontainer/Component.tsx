/**
 * `<ScrollContainer>` — the native (WebGL canvas) painter for
 * `ScrollContainer`. It is the FIRST node to push its own planes into
 * `ControlClipContext` (`../../../../r3f/controls/native/controlClipping.tsx`),
 * and draws a themed scrollbar (`comparison.md` records that Godot's themed
 * `ScrollBar` has no CSS equivalent).
 *
 * CLIPPING. `Control::clip_contents` clips to `Rect2(Point2(), get_size())` —
 * this node's ENTIRE own rect, never reduced by a scrollbar reservation
 * (confirmed against the real engine: the focus-panel comment in
 * `scroll_container.cpp`'s constructor says outright that the scrolled child
 * and the focus border share one CanvasItem and its ONE clip).
 *
 * `useWorldClipPlanes` (`native/controlClipping.tsx`) turns that rect into the
 * 4 world-space planes and merges them onto whatever this node inherited; the
 * result is published to the subtree through `ControlClipProvider` below.
 * `anchorRef` carries no local transform of its own, so its `matrixWorld` is
 * the walker's outer group for this node, composed through every ancestor —
 * exactly "this node's local origin, in world space", which is the frame the
 * rect handed to the hook is expressed in. That origin is the WHOLE-PIXEL
 * snapped one (`native/controlPixelSnap.ts`), while `ownRect` below stays the
 * full-precision `{0, 0, rect.w, rect.h}`, and the pair is deliberate: Godot
 * clips to `Rect2(Point2(), get_size())` — an unrounded size — evaluated
 * inside a canvas item whose translation has already been floored, so the clip
 * edge lands on `floor(position + 0.5) + size`, not on `position + size`.
 *
 * SCROLLBAR GEOMETRY. Reads `meta` (`ContainerLayoutResult.meta`, from this
 * type's registered `ContainerLayoutFn` — `nativeSolver.ts`'s
 * `scrollContainerLayout`) — the FULL `ScrollContainerLayout`
 * `scrollContainerScrollBars` already computed during the REAL solve, whose
 * `SolveContext` cache had every descendant's `combinedMinimumSize` already
 * memoised. Falls back to building a FRESH `SolveContext` (the same
 * `nativeTheme`/`measureText` the real solve uses, via `createSolveContext`)
 * and re-invoking `scrollContainerScrollBars` itself ONLY when `meta` is not
 * a usable `ScrollContainerLayout` (a hand-built test props object) — never
 * to a narrower input (e.g. child `custom_minimum_size` alone), so the
 * fallback and the cached path can never disagree about overflow/grabber
 * geometry, only about how much redundant work they cost. `ScrollBar`'s own
 * grabber has no `autohide`/pointer-state gate in `scene/gui/scroll_bar.cpp`
 * (unlike `SplitContainer`'s split-bar background) — it always draws once
 * its enclosing bar is visible, so this painter never needs interactive
 * state to decide whether to draw one.
 *
 * TINT. Mirrors `PanelChrome.tsx` exactly: the walker already folds this
 * node's OWN `modulate` into the ambient `Modulate2DContext` its descendants
 * (and this painter) read, so re-applying it here would square it — only
 * `self_modulate` reaches `tint.own`, handed to each track/grabber
 * `<StyleBoxQuad>`'s own `color` prop, which composes it onto the StyleBox's
 * two base colours, in sRGB, before its single linear conversion.
 *
 * DRAW ORDER. Both bars use `subtreeChromeRenderOrder`
 * (`ControlComponentRegistry.ts`'s `NativeControlComponentProps`), NOT this
 * node's own `renderOrder` — using `renderOrder` was the ORIGINAL, now-wrong
 * rule, and it drew both bars UNDER the scrolled content instead of over it:
 * `paintIndex` is a single pre-order counter across the WHOLE tree
 * (`native/controlRectSolver.ts`'s `assignPaintIndex`), so every descendant
 * of this ScrollContainer necessarily gets a LARGER paint index — and so a
 * larger `renderOrder` — than this node's own. Godot never draws its
 * scrollbars at this node's own paint slot either: `h_scroll`/`v_scroll` are
 * added via `Node::add_child(..., INTERNAL_MODE_BACK)`
 * (`scene/gui/scroll_container.cpp:919,924`), which places them AFTER every
 * normal child regardless of when they were added, so they paint LAST among
 * this node's own descendants.
 *
 * `subtreeChromeRenderOrder` is `bandBase(layer) + subtreeLastPaintIndex` —
 * the paint index of the LAST descendant in this node's own subtree
 * (`SolvedControl.subtreeLastPaintIndex`, `native/controlRectSolver.ts`) —
 * so it equals that descendant's OWN `renderOrder`, and the solver hands
 * this node's next SIBLING exactly one past it. Both bars must therefore
 * land in that one-wide gap: track at `subtreeChromeRenderOrder + 0.25`,
 * grabber at `+ 0.5` — FRACTIONAL, not `+1`/`+2`, so a `+1` bar can never
 * reach the next sibling's own paint slot the way an integer offset could.
 * (`+0.5` between the two bars was already deliberate for grabber-over-track
 * ordering; `+0.25` for the track follows the same reasoning, now anchored
 * to `subtreeChromeRenderOrder` rather than `renderOrder`.) The two h/v bars
 * never spatially overlap (each dodges the other's own reserved strip), so
 * ordering between them is not load-bearing.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { createSolveContext } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { ControlClipProvider, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import {
  snapControlsToPixelsEnabled,
  snappedControlOrigin,
  type ControlDrawTransform,
} from '../../../../r3f/controls/native/controlPixelSnap';
import { useProjectSettings } from '../../../../r3f/contexts/ProjectSettingsContext';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ControlProperties } from '../control/types';
import {
  scrollContainerScrollBars,
  isScrollContainerLayout,
  type ScrollBarPlacement,
} from './nativeSolver';


/**
 * A ScrollBar's effective `ControlDrawTransform`. `h_scroll`/`v_scroll` are
 * constructed by `ScrollContainer`'s own constructor and placed purely through
 * `set_anchor_and_offset` (`_update_scrollbar_position`), so neither ever
 * carries an authored rotation, scale or pivot — the composite the snap floors
 * is the bar's position alone. Hoisted to a module constant because it is a
 * fact about the engine's own nodes, not a per-render value.
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
  /** Raw sRGB, composed into `track`/`grabber` internally by `<StyleBoxQuad>`'s own `color` prop. */
  color: RGBA;
  /** `subtreeChromeRenderOrder` (or its fallback) — see this module's own DRAW ORDER doc. */
  chromeRenderOrder: number;
  /** `gui/common/snap_controls_to_pixels`, read once by the painter and passed down. */
  snapToPixels: boolean;
}

/**
 * One scrollbar's track + grabber.
 *
 * Two DISTINCT axis conversions are needed here, not one, because
 * `styleBoxFlatGeometry` never flips an axis (its own doc says so — "the
 * caller converts to a three.js position, this module never flips an axis")
 * and never re-origins one either (`rect.x`/`rect.y` are added straight onto
 * every vertex it emits):
 *
 * 1. POSITION — this bar's (or its grabber's) own offset within its parent.
 *    Handled the SAME way the walker positions every Control's own group:
 *    `position={[x, -y, 0]}`, negating Y once.
 * 2. The GEOMETRY's OWN internal axis — `styleBoxFlatGeometry`'s vertices
 *    grow toward LARGER Y as Godot pixels go DOWN the rect (e.g. its bottom
 *    corners are at `rect.y + rect.h`), which is the OPPOSITE of three's
 *    "+Y is up". Left unflipped, a StyleBoxQuad's shape renders upside down
 *    around its own origin. That is invisible for a plain, vertically
 *    symmetric flat fill (a `Panel`'s uniform corner radius, no less) — which
 *    is exactly why this went unnoticed elsewhere — but this painter's whole
 *    POINT is an asymmetric pair (a grabber sitting somewhere inside its
 *    track, not centred), so an unflipped grabber would sit at the WRONG END
 *    of the track. Fixed by a `scale={[1, -1, 1]}` wrapper around the
 *    zero-origin geometry, verified against the real engine's pixels
 *    (`pnpm ref:godot --probe`, see this module's own test suite): a
 *    zero-scroll grabber sits at the TRACK's Godot-top, which after this flip
 *    is world Y ≈ 0 counting down to negative, not the reverse.
 *
 * Both `StyleBoxQuad` calls are always handed a ZERO-origin rect for the SAME
 * reason position is handled by an enclosing group: passing this bar's
 * ALREADY-absolute rect verbatim would double-count that offset once the
 * mesh sits inside a group that already carries it.
 *
 * PIXEL SNAP. `h_scroll`/`v_scroll` are real `HScrollBar`/`VScrollBar` Control
 * nodes (`scene/gui/scroll_container.cpp:919,924`), so each is its OWN
 * CanvasItem and `Control::_update_canvas_item_transform` floors each one's
 * translation INDEPENDENTLY of the ScrollContainer's — a bar under a snapped
 * container still snaps again on its own account. This group is that bar's
 * canvas item, so its position goes through the same
 * `snappedControlOrigin` port the walker uses for every other Control, never a
 * hand-rolled floor. `bar.rect` itself stays at full precision:
 * `_update_scrollbar_position` sets anchors and offsets, `get_rect()` reports
 * what they resolve to, and only the drawn transform is floored — the
 * container's own reservation arithmetic reads the unsnapped numbers.
 *
 * The GRABBER is NOT a node. `ScrollBar`'s own `NOTIFICATION_DRAW`
 * (`scene/gui/scroll_bar.cpp:326-344`) builds a `Rect2` straight from
 * `get_grabber_offset()` — no int cast, no rounding — and draws it into the
 * bar's canvas item, so it inherits the bar's snap and never gets a second one
 * of its own. Nesting its group inside the snapped one is exactly that.
 */
function ScrollBarChrome({ bar, track, grabber, color, chromeRenderOrder, snapToPixels }: ScrollBarChromeProps) {
  if (!bar.visible) return null;
  const origin = snappedControlOrigin(bar.rect, SCROLL_BAR_DRAW_TRANSFORM, snapToPixels);
  // Position only. `StyleBoxQuad` now takes just the size from the rect it is
  // handed and applies the Godot→three y flip itself, so a caller supplies the
  // offset through a group and nothing else.
  return (
    <group position={[origin.x, -origin.y, 0]}>
      <StyleBoxQuad styleBox={track} color={color} rect={bar.rect} renderOrder={chromeRenderOrder + 0.25} />
      <group position={[bar.grabberRect.x, -bar.grabberRect.y, 0]}>
        <StyleBoxQuad styleBox={grabber} color={color} rect={bar.grabberRect} renderOrder={chromeRenderOrder + 0.5} />
      </group>
    </group>
  );
}

export function ScrollContainer({
  solveNode,
  rect,
  subtreeChromeRenderOrder,
  theme,
  children,
  meta,
}: NativeControlComponentProps) {
  const props = solveNode.node.properties as ControlProperties;
  const cachedLayout = isScrollContainerLayout(meta) ? meta : null;
  // FALLBACK ONLY (`cachedLayout` absent, `layout` below): a FRESH
  // SolveContext, built from the exact same theme/measurer the real solve
  // uses — not a second, narrower approximation of one. Rebuilt whenever
  // `solveNode` changes, not only on a theme change: the context carries a
  // path-keyed minimum-size cache, so reusing one across a re-walk (a
  // sub-scene or a child's texture arriving, which gives that child a real
  // minimum where it had none) would answer from the pre-arrival numbers —
  // the bars would disagree with the registered layout fn about whether
  // anything overflows. `solveNode` is an intentional cache-buster, not a
  // value the callback reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const solveCtx = useMemo(() => createSolveContext(theme, measureText), [theme, solveNode]);
  const layout = useMemo(
    () => cachedLayout ?? scrollContainerScrollBars(solveNode, solveCtx, rect),
    [cachedLayout, solveNode, solveCtx, rect]
  );

  const selfModulate = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  // The bars are separate CanvasItems, so the walker's snap of THIS node's own
  // group does not reach them — read the same setting the walker reads and
  // snap each bar on its own account (see `ScrollBarChrome`'s PIXEL SNAP doc).
  const snapToPixels = snapControlsToPixelsEnabled(useProjectSettings().settings);

  // The whole widget rect clips its subtree — the planes go into the Provider below.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(ownRect);

  return (
    <group ref={anchorRef}>
      <ControlClipProvider value={clippingPlanes}>
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
    </group>
  );
}
