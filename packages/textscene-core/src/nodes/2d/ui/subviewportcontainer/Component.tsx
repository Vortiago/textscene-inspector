/**
 * `<SubViewportContainer>` — the native (WebGL canvas) painter for
 * `SubViewportContainer` (ADR-0033).
 *
 * Godot draws EVERY `SubViewport` child, stacked in tree order, sized from
 * `stretch` (see `ViewportSurfaceNative` below for the exact rule). Every
 * sub-viewport kind (3D, 2D-world, and the native Control-raster pass,
 * `../../viewport/subviewport/ControlRasterPass.tsx`) publishes a
 * `ViewportTextureEntry` whose `texture` this painter samples DIRECTLY on a
 * `<ControlQuad>`, with no CPU round trip.
 *
 * CYCLE FALLBACK. This painter samples its nested viewport's target through
 * `useViewportTargetSlot` — the SAME choke point every other ViewportTexture
 * consumer shares (`resources/textures/viewporttexture/useViewportTextureSlot.ts`),
 * called with its target's PATH directly rather than through a SubResource ref
 * (a nested `<SubViewport>` names no ref; this painter already knows the path).
 * A cyclic target (the ordered pass driver, `ViewportPassRegistryContext.tsx`,
 * found this viewport's own dependency chain unsatisfiable — two viewports
 * each depending, directly or transitively, on the other's target) reports
 * `texture: null, cyclic: true` rather than the published entry's raw,
 * never-written texture: this painter renders the SAME outline
 * `<ControlFallback>` draws for an unregistered type, since "this viewport's
 * content is not available" is the same visible fact a missing painter
 * reports. Passed `warnAs: null` — the driver's own cycle-detection effect
 * already logs the offending path once, so this painter does not warn a
 * second time.
 *
 * Also republishes the STRETCHING container's forced rect
 * (`ViewportRectContext`), the return leg of ADR-0033's seam: with `stretch`
 * on, Godot resizes the sub-viewport to `get_size() / stretch_shrink`
 * (`recalc_force_viewport_sizes`), and the solved `rect` this painter already
 * receives from the Control layout solver IS that container rect — no extra
 * measurement round trip needed.
 *
 * TINT. `NOTIFICATION_DRAW` composites each child viewport with a plain
 * `draw_texture_rect(c->get_texture(), rect)` — no explicit colour argument —
 * but every `CanvasItem` draw call is tinted by the item's own
 * `modulate`/`self_modulate` at the rendering-server level
 * (`RenderingServer::canvas_item_set_modulate`/`_self_modulate`), the same
 * mechanism a `ColorRect` or `TextureRect`'s draw calls go through. Measured
 * on a scratch fixture through Godot 4.6.3 (see `comparison.md`'s Item 2
 * row): a `ColorRect(0.8, 0.8, 0.8)` filling the sub-viewport reads rgb(204)
 * with no tint, rgb(102) with `self_modulate = Color(0.5, 0.5, 0.5, 1)`
 * (204 × 0.5 exactly), and rgb(51) with an ANCESTOR `modulate = Color(0.5,
 * 0.5, 0.5, 1)` on top of that same `self_modulate` (204 × 0.5 × 0.5 exactly)
 * — a plain multiply in the same sRGB-authored space the content colour
 * lives in, confirming this painter should fold tint exactly the way every
 * other native painter does: the walker's `tint` prop. One value for the whole
 * container (Godot's `self_modulate` is one CanvasItem property, shared by
 * every child viewport's `draw_texture_rect` call in the same
 * `NOTIFICATION_DRAW`), handed on to every `ViewportSurfaceNative`.
 */
import { useEffect, useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry.js';
import { painterView, type SolveNode } from '../../../../r3f/controls/native/solveTree.js';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad.js';
import { ControlFallback } from '../../../../r3f/controls/native/ControlFallback.js';
import type { Rect2 } from '../../../../r3f/controls/native/rect.js';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker.js';
import { useBuildSolveTree } from '../../../../r3f/controls/native/buildSolveTree.js';
import { ControlClipProvider, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping.js';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext.js';
import { useViewportTargetSlot } from '../../../../resources/textures/viewporttexture/useViewportTextureSlot.js';
import { useRegisterViewportRect } from '../../../../r3f/contexts/ViewportRectContext.js';
import { joinPath } from '../../../../utils/nodePath.js';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../../parser/types.js';
import { isViewportBoundary } from '../../../viewport/subviewport/viewportBoundary.js';
import type { SubViewportProperties } from '../../../viewport/subviewport/types.js';
import type { SubViewportContainerProperties } from './types.js';
import { WHOLE_CANVAS_RANGE } from '../../../../r3f/canvasPaintOrder.js';

const NO_CHILD_RECTS: ReadonlyMap<string, Rect2> = new Map();

interface ViewportSurfaceNativeProps {
  viewport: TscnNode;
  path: string;
  containerRect: Rect2;
  stretch: boolean;
  shrink: number;
  renderOrder: number;
  /** Forwarded to `<ControlFallback>` on the cycle branch — see `NativeControlComponentProps.effectiveZ`. */
  effectiveZ: number;
  theme: NativeControlComponentProps['theme'];
  measureText: NativeControlComponentProps['measureText'];
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
  /** The container's own painter tint, shared by every nested viewport's composited quad. */
  tint: NativeControlComponentProps['tint'];
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
  effectiveZ,
  theme,
  measureText,
  externalResources,
  internalResources,
  tint,
}: ViewportSurfaceNativeProps) {
  const props = viewport.properties as SubViewportProperties;
  const authoredSize = props.size ?? { x: 512, y: 512 };

  // With `stretch` off each viewport draws at its OWN size, anchored at the
  // container's top-left (Godot never offsets successive children); with it
  // on every viewport fills the container's rect instead — the container
  // rect does not size the content otherwise.
  const width = stretch ? Math.max(1, Math.round(containerRect.w)) : Math.max(1, Math.round(authoredSize.x));
  const height = stretch ? Math.max(1, Math.round(containerRect.h)) : Math.max(1, Math.round(authoredSize.y));

  // The rect the sub-viewport itself renders AT: unshrunk unless stretching,
  // in which case Godot's `set_size_force(get_size() / stretch_shrink)` is
  // exactly `width / shrink` — the CONTAINER's already-solved rect divided
  // down, no extra measurement round trip needed.
  const registerViewportRect = useRegisterViewportRect();
  useEffect(() => {
    if (!stretch) return undefined;
    const forced = {
      x: Math.max(1, Math.round(width / shrink)),
      y: Math.max(1, Math.round(height / shrink)),
    };
    return registerViewportRect(path, forced);
  }, [registerViewportRect, path, stretch, width, height, shrink]);

  const { texture, cyclic } = useViewportTargetSlot(path, null);

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
    () => ({
      path,
      node: viewport,
      children: [],
      // A SubViewport draws into its own target, so this root orders nothing
      // against the enclosing canvas — it starts a fresh range of its own.
      paintRange: WHOLE_CANVAS_RANGE,
      paintSequence: WHOLE_CANVAS_RANGE.base,
      styleBoxes: {},
      textureSize: null,
      // This synthetic root stands in for the SubViewport itself (never a
      // real Control `buildSolveTree.ts` walked), so it carries no theme of
      // its own to inherit — matching what that walker would produce for a
      // themeless root.
      fontOverrides: {},
      themeChain: [],
      projectTheme: null,
    }),
    [path, viewport]
  );

  const scale = shrinking ? shrink : 1;

  // The render target is only `renderedWidth`x`renderedHeight` pixels — Godot
  // clips a viewport's content to exactly that, as a CONSEQUENCE of nothing
  // past its edge ever having been rendered, never as an explicit operation.
  // The Controls arm draws as ordinary three.js objects with no such boundary
  // of its own, so it needs an explicit clip (`ScrollContainer`'s own
  // mechanism) to match; the pixel arm's own geometry is already exactly this
  // size, so it needs none.
  const clipRect = useMemo(() => ({ x: 0, y: 0, w: renderedWidth, h: renderedHeight }), [renderedWidth, renderedHeight]);
  const { anchorRef, clip } = useWorldClipPlanes(clipRect);

  return (
    <CanvasItemGroup ref={anchorRef} scale={[scale, scale, 1]}>
      <ControlClipProvider value={clip}>
        {cyclic ? (
          <ControlFallback
            solveNode={fallbackSolveNode}
            rect={clipRect}
            renderOrder={renderOrder}
            effectiveZ={effectiveZ}
            // The cycle branch renders no subtree at all — nothing draws below
            // this surface — so the fallback's own slot IS its subtree's last.
            subtreeChromeRenderOrder={renderOrder}
            theme={theme}
            // Threaded for the contract; the outline is a diagnostic and
            // deliberately draws in its own colour, untinted.
            tint={tint}
            // A SubViewport is never the root window, so it keeps
            // `Viewport::snap_controls_to_pixels`' own `= true` initialiser
            // (`scene/main/viewport.h`) whatever the project setting says.
            snapToPixels
            measureText={measureText}
            childRects={NO_CHILD_RECTS}
            meta={undefined}
          />
        ) : texture ? (
          <ControlQuad
            width={renderedWidth}
            height={renderedHeight}
            color={tint.color}
            opacity={tint.opacity}
            map={texture}
            renderOrder={renderOrder}
          />
        ) : null}
        <ControlCanvasWalker
          tree={tree}
          generation={generation}
          viewport={controlsViewport}
          theme={theme}
          measurer={measureText}
          // `scene/main/viewport.h`: `bool snap_controls_to_pixels = true` on
          // every Viewport, and only the root window is ever handed
          // `gui/common/snap_controls_to_pixels` (`main/main.cpp`). These are
          // the sub-viewport's OWN Controls, so the project's opt-out — which
          // is the root window's alone — never reaches them.
          snapToPixels
        />
      </ControlClipProvider>
    </CanvasItemGroup>
  );
}

export function SubViewportContainer({
  solveNode,
  tint,
  rect,
  renderOrder,
  effectiveZ,
  theme,
  measureText,
}: NativeControlComponentProps) {
  const props = painterView<SubViewportContainerProperties>(solveNode);
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
          effectiveZ={effectiveZ}
          tint={tint}
          // Each successive viewport draws ON TOP of the last (Godot's own
          // tree-order stacking) — a fraction below the next paint index's
          // integer slot, matching the small-offset convention
          // the painter contract documents (e.g. a scrollbar grabber's `+0.5`).
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
