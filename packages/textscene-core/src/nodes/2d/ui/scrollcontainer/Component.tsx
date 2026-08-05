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
 * `anchorRef` carries no local transform of its own, so its `matrixWorld`
 * equals the walker's outer group for this node (rect.x, -rect.y, composed
 * through every ancestor) — exactly "this node's local origin, in world
 * space", which is the frame the rect handed to the hook is expressed in.
 *
 * SCROLLBAR GEOMETRY. `scrollContainerScrollBars` (`nativeSolver.ts`) is the
 * ONE function this painter and `scrollContainerLayout` (this type's
 * registered `ContainerLayoutFn`) both call — this painter builds its OWN
 * fresh `SolveContext` (the same `nativeTheme`/`measureText` the real solve
 * uses, via `createSolveContext`) and re-invokes that SAME pure function
 * rather than re-deriving overflow/grabber geometry from a narrower input
 * (e.g. child `custom_minimum_size` alone) — the two callers would otherwise
 * be two formulas that could silently drift apart. `ScrollBar`'s own grabber
 * has no `autohide`/pointer-state gate in `scene/gui/scroll_bar.cpp` (unlike
 * `SplitContainer`'s split-bar background) — it always draws once its
 * enclosing bar is visible, so this painter never needs interactive state to
 * decide whether to draw one.
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
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ControlProperties } from '../control/types';
import { scrollContainerScrollBars, type ScrollBarPlacement } from './nativeSolver';


interface ScrollBarChromeProps {
  bar: ScrollBarPlacement;
  track: StyleBoxFlatData;
  grabber: StyleBoxFlatData;
  /** Raw sRGB, composed into `track`/`grabber` internally by `<StyleBoxQuad>`'s own `color` prop. */
  color: RGBA;
  /** `subtreeChromeRenderOrder` (or its fallback) — see this module's own DRAW ORDER doc. */
  chromeRenderOrder: number;
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
 */
function ScrollBarChrome({ bar, track, grabber, color, chromeRenderOrder }: ScrollBarChromeProps) {
  if (!bar.visible) return null;
  // Position only. `StyleBoxQuad` now takes just the size from the rect it is
  // handed and applies the Godot→three y flip itself, so a caller supplies the
  // offset through a group and nothing else.
  return (
    <group position={[bar.rect.x, -bar.rect.y, 0]}>
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
}: NativeControlComponentProps) {
  const props = solveNode.node.properties as ControlProperties;
  // A FRESH SolveContext, built from the exact same theme/measurer the real
  // solve uses — not a second, narrower approximation of one. Rebuilt whenever
  // `solveNode` changes, not only on a theme change: the context carries a
  // path-keyed minimum-size cache, so reusing one across a re-walk (a sub-scene
  // or a child's texture arriving, which gives that child a real minimum where
  // it had none) would answer from the pre-arrival numbers — the bars would
  // disagree with the registered layout fn about whether anything overflows.
  // `solveNode` is an intentional cache-buster, not a value the callback reads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const solveCtx = useMemo(() => createSolveContext(theme, measureText), [theme, solveNode]);
  const layout = useMemo(
    () => scrollContainerScrollBars(solveNode, solveCtx, rect),
    [solveNode, solveCtx, rect]
  );

  const selfModulate = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

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
        />
        <ScrollBarChrome
          bar={layout.vertical}
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeRenderOrder={subtreeChromeRenderOrder}
        />
        {children}
      </ControlClipProvider>
    </group>
  );
}
