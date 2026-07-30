/**
 * `<SubViewportContainerNative>` — the native (WebGL canvas) painter for
 * `SubViewportContainer`, the ONE viewport surface (ADR-0030) that had no
 * native painter: native Controls default to `true`
 * (`Canvas2DStage.tsx`), so without this the DOM `<ControlOverlay>` never
 * mounts and a scene containing a `SubViewportContainer` lost its viewport
 * content entirely, falling back to `<ControlFallback>`'s outline.
 *
 * Godot draws EVERY `SubViewport` child, stacked in tree order, sized from
 * `stretch` — the same rule the DOM twin (`Component.tsx`) documents in full.
 * The DOM twin snapshots a target into CPU pixels (`readPixels`) because a
 * `<canvas>` cannot sample a WebGL texture; this painter has no such
 * limitation — every sub-viewport kind (3D, 2D-world, and the native
 * Control-raster pass, `../../viewport/subviewport/ControlRasterPass.tsx`)
 * now publishes a `ViewportTextureEntry` whose `texture` this painter samples
 * DIRECTLY on a `<ControlQuad>`, with no CPU round trip.
 *
 * CYCLE FALLBACK. The ordered pass driver (`ViewportPassRegistryContext.tsx`)
 * can find a viewport's own dependency chain unsatisfiable (two viewports
 * each depending, directly or transitively, on the other's target) — the
 * driver itself never runs that pass, so the published texture (if any)
 * stays frozen rather than reflecting anything live. `useViewportPassCycle`
 * is this painter's own seam onto that: a cyclic path renders the SAME
 * outline `<ControlFallback>` draws for an unregistered type, since "this
 * viewport's content is not available" is the same visible fact a missing
 * painter reports, and the driver's own effect already logs the offending
 * path — this painter does not warn a second time.
 *
 * Also republishes the STRETCHING container's forced rect
 * (`ViewportRectContext`), the return leg of ADR-0030's seam: with `stretch`
 * on, Godot resizes the sub-viewport to `get_size() / stretch_shrink`
 * (`recalc_force_viewport_sizes`), and the solved `rect` this painter already
 * receives from the Control layout solver IS that container rect — no DOM
 * measurement round trip needed, unlike the overlay twin's `ResizeObserver`.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry.js';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad.js';
import { ControlFallback } from '../../../../r3f/controls/native/ControlFallback.js';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree.js';
import type { Rect2 } from '../../../../r3f/controls/native/rect.js';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker.js';
import { useBuildSolveTree } from '../../../../r3f/controls/native/buildSolveTree.js';
import { ControlClipProvider, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping.js';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext.js';
import { useViewportTexture } from '../../../../r3f/contexts/ViewportTextureContext.js';
import { useViewportPassCycle } from '../../../../r3f/contexts/ViewportPassRegistryContext.js';
import { useRegisterViewportRect } from '../../../../r3f/contexts/ViewportRectContext.js';
import { joinPath } from '../../../../utils/nodePath.js';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../../parser/types.js';
import { isViewportBoundary } from '../../../viewport/subviewport/viewportBoundary.js';
import type { SubViewportProperties } from '../../../viewport/subviewport/types.js';
import type { SubViewportContainerProperties } from './types.js';

const WHITE = new THREE.Color(1, 1, 1);
const NO_CHILD_RECTS: ReadonlyMap<string, Rect2> = new Map();

interface ViewportSurfaceNativeProps {
  viewport: TscnNode;
  path: string;
  containerRect: Rect2;
  stretch: boolean;
  shrink: number;
  renderOrder: number;
  theme: NativeControlComponentProps['theme'];
  measureText: NativeControlComponentProps['measureText'];
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
}

/**
 * One nested `SubViewport`'s surface: the pixel arm (a quad sampling its
 * published texture, or the cycle/unpublished fallback) plus the Controls
 * arm (its own direct Control children, drawn live — the always-on mechanism
 * that composites a MIXED 3D/2D-plus-Controls viewport's Controls on top,
 * since the offscreen pass only ever renders one non-Control content kind).
 */
function ViewportSurfaceNative({
  viewport,
  path,
  containerRect,
  stretch,
  shrink,
  renderOrder,
  theme,
  measureText,
  externalResources,
  internalResources,
}: ViewportSurfaceNativeProps) {
  const props = viewport.properties as SubViewportProperties;
  const authoredSize = props.size ?? { x: 512, y: 512 };

  // With `stretch` off each viewport draws at its OWN size, anchored at the
  // container's top-left (Godot never offsets successive children); with it
  // on every viewport fills the container's rect instead — the container
  // rect does not size the content otherwise (`Component.tsx`'s own doc).
  const width = stretch ? Math.max(1, Math.round(containerRect.w)) : Math.max(1, Math.round(authoredSize.x));
  const height = stretch ? Math.max(1, Math.round(containerRect.h)) : Math.max(1, Math.round(authoredSize.y));

  // The rect the sub-viewport itself renders AT: unshrunk unless stretching,
  // in which case Godot's `set_size_force(get_size() / stretch_shrink)` is
  // exactly `width / shrink` — the CONTAINER's already-solved rect divided
  // down, no DOM measurement needed the way the overlay twin's surface does.
  const registerViewportRect = useRegisterViewportRect();
  useEffect(() => {
    if (!stretch) return undefined;
    const forced = {
      x: Math.max(1, Math.round(width / shrink)),
      y: Math.max(1, Math.round(height / shrink)),
    };
    return registerViewportRect(path, forced);
  }, [registerViewportRect, path, stretch, width, height, shrink]);

  const entry = useViewportTexture(path);
  const cycle = useViewportPassCycle(path);

  // Controls anchor against the RENDERED rect (post-shrink when stretching):
  // Godot lays a viewport's own Controls out against the target it actually
  // renders at, then the WHOLE target (pixels + composited Controls) is what
  // gets scaled back up to fill the container.
  // `shrink` only bites while stretching, and only above 1 — the same predicate
  // decides the rendered size and the scale it is blown back up by, so the two
  // can never disagree.
  const shrinking = stretch && shrink > 1;
  const renderedWidth = shrinking ? Math.max(1, Math.round(width / shrink)) : width;
  const renderedHeight = shrinking ? Math.max(1, Math.round(height / shrink)) : height;

  const { tree, generation } = useBuildSolveTree(viewport.children, externalResources, internalResources);
  const controlsViewport: Rect2 = useMemo(
    () => ({ x: 0, y: 0, w: renderedWidth, h: renderedHeight }),
    [renderedWidth, renderedHeight]
  );

  const fallbackSolveNode = useMemo<SolveNode>(
    () => ({ path, node: viewport, children: [], styleBoxes: {}, textureSize: null }),
    [path, viewport]
  );

  const scale = shrinking ? shrink : 1;

  // The render target is only `renderedWidth`x`renderedHeight` pixels — Godot
  // clips a viewport's content to exactly that, as a CONSEQUENCE of nothing
  // past its edge ever having been rendered, never as an explicit operation
  // (`Component.tsx`'s own doc). The Controls arm draws as ordinary three.js
  // objects with no such boundary of its own, so it needs an explicit clip
  // (`ScrollContainerNative`'s own mechanism) to match; the pixel arm's own
  // geometry is already exactly this size, so it needs none.
  const clipRect = useMemo(() => ({ x: 0, y: 0, w: renderedWidth, h: renderedHeight }), [renderedWidth, renderedHeight]);
  const { anchorRef, clippingPlanes } = useWorldClipPlanes(clipRect);

  return (
    <group ref={anchorRef} scale={[scale, scale, 1]}>
      <ControlClipProvider value={clippingPlanes}>
        {cycle ? (
          <ControlFallback
            solveNode={fallbackSolveNode}
            rect={clipRect}
            renderOrder={renderOrder}
            theme={theme}
            measureText={measureText}
            childRects={NO_CHILD_RECTS}
          />
        ) : entry ? (
          <ControlQuad
            width={renderedWidth}
            height={renderedHeight}
            color={WHITE}
            opacity={1}
            map={entry.texture}
            renderOrder={renderOrder}
          />
        ) : null}
        <ControlCanvasWalker
          tree={tree}
          generation={generation}
          viewport={controlsViewport}
          theme={theme}
          measurer={measureText}
        />
      </ControlClipProvider>
    </group>
  );
}

export function SubViewportContainerNative({
  solveNode,
  rect,
  renderOrder,
  theme,
  measureText,
}: NativeControlComponentProps) {
  const props = solveNode.node.properties as SubViewportContainerProperties;
  const stretch = props.stretch ?? false;
  const shrink = Math.max(1, props.stretch_shrink ?? 1);
  const { externalResources, internalResources } = useSceneResources();

  // Raw live children (unlike `solveNode.children`, the Control-only solve
  // forest — `buildSolveTree` skips a viewport boundary entirely), so a
  // nested `SubViewport` is found here rather than via the walker.
  const viewports = solveNode.node.children.filter((child) => isViewportBoundary(child.type));

  return (
    <>
      {viewports.map((viewport, index) => (
        <ViewportSurfaceNative
          key={viewport.name}
          viewport={viewport}
          path={joinPath(solveNode.path, viewport.name)}
          containerRect={rect}
          stretch={stretch}
          shrink={shrink}
          // Each successive viewport draws ON TOP of the last (Godot's own
          // tree-order stacking) — a fraction below the next paint index's
          // integer slot, matching the small-offset convention
          // `controlDrawOrder.ts` documents (e.g. a scrollbar grabber's `+0.5`).
          renderOrder={renderOrder + (index + 1) / 100}
          theme={theme}
          measureText={measureText}
          externalResources={externalResources}
          internalResources={internalResources}
        />
      ))}
    </>
  );
}
