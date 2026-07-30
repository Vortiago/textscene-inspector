/**
 * `<ScrollContainerNative>` — the native (WebGL canvas) painter for
 * `ScrollContainer`. This is the packet that makes clipping real: it is the
 * FIRST node to push its own planes into `ControlClipContext`
 * (`../../../../r3f/controls/native/controlClipping.tsx`), and the first to
 * draw a themed scrollbar at all (`comparison.md` records the DOM overlay
 * draws none, since Godot's themed `ScrollBar` is unpaintable in CSS).
 *
 * CLIPPING. `Control::clip_contents` clips to `Rect2(Point2(), get_size())` —
 * this node's ENTIRE own rect, never reduced by a scrollbar reservation
 * (confirmed against the real engine: the focus-panel comment in
 * `scroll_container.cpp`'s constructor says outright that the scrolled child
 * and the focus border share one CanvasItem and its ONE clip). Those 4 planes
 * are built in this node's own LOCAL frame by `localRectClipPlanes`, then
 * transformed into WORLD space via `anchorRef`'s own `matrixWorld` —
 * `clippingPlanes` are evaluated against the fragment's world position, so a
 * plane expressed only in local coordinates is only correct for a node with
 * no ancestor offset at all. `anchorRef` carries no local transform of its
 * own, so its `matrixWorld` equals whatever the walker's outer group for this
 * node already is (rect.x, -rect.y, composed through every ancestor) — which
 * is exactly "this node's local origin, in world space".
 *
 * That computation runs in `useLayoutEffect` with NO dependency array (so it
 * runs after every render, not just once): a Control's ancestor chain is not
 * a React value the effect could depend on — it is whatever three composed
 * through the whole tree by the time refs settle, the same argument
 * `useShadowLightPose` (`r3f/lighting2d/shadowLightPose.ts`) makes for
 * sampling every frame rather than once. Running the layout effect on mount
 * (before any browser paint) makes a STILL frame correct with no render loop
 * having run at all; the guard below (comparing the flattened plane numbers
 * against the previous computation) is not an optimisation, it is what stops
 * that same-every-render effect from calling `setState` forever — a state
 * update inside `useLayoutEffect` re-renders synchronously, so an
 * unconditional `setState` here would loop.
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
 * `self_modulate` composes onto the track/grabber StyleBoxes' two base
 * colours, in sRGB, before `StyleBoxQuad`'s single linear conversion.
 *
 * `renderOrder` reaches every mesh this painter emits: each bar's track uses
 * the node's own `renderOrder`, and its grabber uses `renderOrder + 0.5` — a
 * FRACTIONAL offset, not `+1`, deliberately: every legitimate `renderOrder`
 * in this codebase is `bandBase(layer) + paintIndex`
 * (`native/controlDrawOrder.ts`), and both terms are always integers, so a
 * `+0.5` offset can never collide with another Control's own paint slot the
 * way an integer `+1` could (that would land exactly on this node's own
 * first child's slot, since paint index is a single pre-order counter across
 * the whole tree). The two h/v bars never spatially overlap (each dodges the
 * other's own reserved strip), so ordering between them is not load-bearing.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { createSolveContext } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import {
  ControlClipProvider,
  localRectClipPlanes,
  useControlClipPlanes,
  withAdditionalClipPlanes,
} from '../../../../r3f/controls/native/controlClipping';
import { StyleBoxQuad, tintStyleBox } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useCanvasItemTint, WHITE_MODULATE } from '../../../../r3f/canvasItemModulate';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ControlProperties } from '../control/types';
import { scrollContainerScrollBars, type ScrollBarPlacement } from './nativeSolver';

/** 4 planes × (normal.x, normal.y, normal.z, constant). */
const PLANE_FLOATS = 16;

function flattenPlanes(planes: readonly THREE.Plane[], out: Float64Array): void {
  planes.forEach((p, i) => {
    out[i * 4] = p.normal.x;
    out[i * 4 + 1] = p.normal.y;
    out[i * 4 + 2] = p.normal.z;
    out[i * 4 + 3] = p.constant;
  });
}

function sameFloats(a: Float64Array, b: Float64Array): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}


interface ScrollBarChromeProps {
  bar: ScrollBarPlacement;
  track: StyleBoxFlatData;
  grabber: StyleBoxFlatData;
  renderOrder: number;
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
function ScrollBarChrome({ bar, track, grabber, renderOrder }: ScrollBarChromeProps) {
  if (!bar.visible) return null;
  // Position only. `StyleBoxQuad` now takes just the size from the rect it is
  // handed and applies the Godot→three y flip itself, so a caller supplies the
  // offset through a group and nothing else.
  return (
    <group position={[bar.rect.x, -bar.rect.y, 0]}>
      <StyleBoxQuad styleBox={track} rect={bar.rect} renderOrder={renderOrder} />
      <group position={[bar.grabberRect.x, -bar.grabberRect.y, 0]}>
        <StyleBoxQuad styleBox={grabber} rect={bar.grabberRect} renderOrder={renderOrder + 0.5} />
      </group>
    </group>
  );
}

export function ScrollContainerNative({ solveNode, rect, renderOrder, theme, children }: NativeControlComponentProps) {
  const props = solveNode.node.properties as ControlProperties;
  // A FRESH SolveContext, built from the exact same theme/measurer the real
  // solve uses — not a second, narrower approximation of one.
  const solveCtx = useMemo(() => createSolveContext(theme, measureText), [theme]);
  const layout = useMemo(
    () => scrollContainerScrollBars(solveNode, solveCtx, rect),
    [solveNode, solveCtx, rect]
  );

  const selfModulate = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  const trackHorizontal = useMemo(
    () => tintStyleBox(theme.widgets.scrollBar.scrollHorizontal, tint.own),
    [theme, tint.own]
  );
  const trackVertical = useMemo(
    () => tintStyleBox(theme.widgets.scrollBar.scrollVertical, tint.own),
    [theme, tint.own]
  );
  const grabber = useMemo(() => tintStyleBox(theme.widgets.scrollBar.grabber, tint.own), [theme, tint.own]);

  const inherited = useControlClipPlanes();
  const anchorRef = useRef<THREE.Group>(null);
  const [ownPlanes, setOwnPlanes] = useState<readonly THREE.Plane[]>([]);
  const previousFloats = useRef<Float64Array | null>(null);

  // Deliberately no dependency array: an ancestor's world transform is not a
  // React value this effect could list (it is whatever three composed through
  // the WHOLE tree by the time refs settle, not just this node's own `rect`),
  // so it must re-sample after every render, exactly like `useShadowLightPose`
  // samples every FRAME for the identical reason. The guard below (comparing
  // flattened plane numbers against the previous computation) is what stops
  // that same-every-render effect from calling `setState` forever, not this
  // rule.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.updateWorldMatrix(true, false);
    const local = localRectClipPlanes({ x: 0, y: 0, w: rect.w, h: rect.h });
    const world = local.map((p) => p.clone().applyMatrix4(anchor.matrixWorld));
    const floats = new Float64Array(PLANE_FLOATS);
    flattenPlanes(world, floats);
    if (previousFloats.current && sameFloats(previousFloats.current, floats)) return;
    previousFloats.current = floats;
    setOwnPlanes(world);
  });

  // Memoised, not recomputed inline: this is a context VALUE, and
  // `withAdditionalClipPlanes` necessarily returns a fresh array once this node
  // contributes planes of its own. A fresh identity per render re-renders every
  // descendant consumer, and `TextRun` keys its `ShaderMaterial` off this array
  // — so an inline call rebuilds (and disposes) one material per glyph run on
  // every render of this container.
  const merged = useMemo(() => withAdditionalClipPlanes(inherited, ownPlanes), [inherited, ownPlanes]);

  return (
    <group ref={anchorRef}>
      <ControlClipProvider value={merged}>
        <ScrollBarChrome bar={layout.horizontal} track={trackHorizontal} grabber={grabber} renderOrder={renderOrder} />
        <ScrollBarChrome bar={layout.vertical} track={trackVertical} grabber={grabber} renderOrder={renderOrder} />
        {children}
      </ControlClipProvider>
    </group>
  );
}
