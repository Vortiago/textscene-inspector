/**
 * `<SubViewportContainer>`: the native painter for `SubViewportContainer` (ADR-0033). Godot draws
 * every `SubViewport` child, stacked in tree order and sized from `stretch`. Each sub-viewport kind
 * publishes a `ViewportTextureEntry` whose `texture` a `<ControlQuad>` samples with no CPU round trip.
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
import { useViewportTargetSlot } from '../../../../resources/textures/viewporttexture/useViewportTextureSlot.js';
import { useRegisterViewportRect } from '../../../../r3f/contexts/ViewportRectContext.js';
import { joinPath } from '../../../../utils/nodePath.js';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../../parser/types.js';
import { isViewportBoundary } from '../../../viewport/subviewport/viewportBoundary.js';
import { useViewportContentKind } from '../../../viewport/subviewport/useViewportContentKind.js';
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
  /** Forwarded to `<ControlFallback>` on the cycle branch (`NativeControlComponentProps.effectiveZ`). */
  effectiveZ: number;
  theme: NativeControlComponentProps['theme'];
  measureText: NativeControlComponentProps['measureText'];
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
  /**
   * The container's painter tint, shared by every nested viewport's quad. `draw_texture_rect` passes
   * no colour, and the rendering server applies `modulate`/`self_modulate`
   * (`RenderingServer::canvas_item_set_modulate`/`_self_modulate`) as for any CanvasItem.
   */
  tint: NativeControlComponentProps['tint'];
  /**
   * The container's `is_layout_rtl()`. The climb casts each ancestor to `Control`, then to `Window`,
   * then takes `get_parent()` (`control.cpp:3584-3598`). A `SubViewport` is neither, so the
   * viewport's Controls inherit from this container.
   */
  rtl: boolean;
}

/**
 * One nested `SubViewport`'s surface: the pixel arm (a quad sampling its texture, or the fallback)
 * and the Controls arm (its direct Control children, drawn live over a mixed viewport, since the
 * offscreen pass renders only one non-Control content kind).
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
  rtl,
}: ViewportSurfaceNativeProps) {
  const props = viewport.properties as SubViewportProperties;
  const authoredSize = props.size ?? { x: 512, y: 512 };

  // `SubViewportContainer::recalc_force_viewport_sizes` (`:94`) is `set_size_force(get_size() /
  // shrink)` into a `Size2i`, and `Vector2::operator Vector2i` (`vector2.cpp:213`) truncates. The raw
  // rect is divided, not a pre-rounded width, or the truncation happens one step too late.
  const forcedSize = useMemo(
    () => ({
      // A zero-pixel render target is not allocatable, so the floor is ours;
      // Godot has no such content to draw either way.
      x: Math.max(1, Math.trunc(containerRect.w / shrink)),
      y: Math.max(1, Math.trunc(containerRect.h / shrink)),
    }),
    [containerRect.w, containerRect.h, shrink]
  );

  // With `stretch` off each viewport draws at its own size at the container's top-left, and Godot
  // never offsets successive children. With it on, the forced size is the target.
  const width = stretch ? forcedSize.x * shrink : Math.max(1, Math.round(authoredSize.x));
  const height = stretch ? forcedSize.y * shrink : Math.max(1, Math.round(authoredSize.y));

  // The return leg of ADR-0033's seam: with `stretch` on, Godot resizes the sub-viewport to
  // `get_size() / stretch_shrink`, and the solved `rect` is already that container rect.
  const registerViewportRect = useRegisterViewportRect();
  useEffect(() => {
    if (!stretch) return undefined;
    return registerViewportRect(path, forcedSize);
  }, [registerViewportRect, path, stretch, forcedSize]);

  // By path, since a nested `<SubViewport>` names no ref. A dependency cycle
  // (`ViewportPassRegistryContext.tsx`) reports `cyclic: true` and draws `<ControlFallback>`'s outline,
  // the same "content unavailable" fact. `warnAs` is `null`: the pass driver logs the cycle once.
  const { texture, cyclic } = useViewportTargetSlot(path, null);

  // Controls anchor against the rendered rect (post-shrink when stretching), and the whole target
  // is then scaled up to fill the container. One predicate decides the rendered size and the
  // scale, so the two always agree.
  const shrinking = stretch && shrink > 1;
  const renderedWidth = shrinking ? forcedSize.x : width;
  const renderedHeight = shrinking ? forcedSize.y : height;

  const contentKind = useViewportContentKind(viewport);
  const { tree, generation } = useBuildSolveTree(viewport.children, externalResources, internalResources, rtl);
  const controlsViewport: Rect2 = useMemo(
    () => ({ x: 0, y: 0, w: renderedWidth, h: renderedHeight }),
    [renderedWidth, renderedHeight]
  );

  const fallbackSolveNode = useMemo<SolveNode>(
    () => ({
      path,
      node: viewport,
      children: [],
      // A SubViewport draws into its own render target, so no ancestor canvas item reaches in.
      skippedAncestors: null,
      // A SubViewport draws into its own target, so this root orders nothing
      // against the enclosing canvas: it starts a fresh range.
      paintRange: WHOLE_CANVAS_RANGE,
      paintSequence: WHOLE_CANVAS_RANGE.base,
      // The SubViewport itself, not a scene node the outliner can hide.
      hidden: false,
      // A Viewport is neither a CanvasItem nor a CanvasLayer, so the `parent_visible_in_tree` climb
      // runs past it and answers `true` (`canvas_item.cpp:330-350`). An ancestor Control's
      // `visible = false` never reaches inside.
      parentVisibleInTree: true,
      // A Viewport is neither a Control nor a Window, so it states no layout direction: the climb
      // passes through it to this container (`control.cpp:3584-3598`).
      rtl,
      styleBoxes: {},
      textureSize: null,
      textureSlots: {},
      // This synthetic root stands in for the SubViewport, not a Control `buildSolveTree.ts` walked,
      // so it carries no theme, as that walker gives a themeless root.
      fontOverrides: {},
      themeChain: [],
      projectTheme: null,
      colors: {},
      constants: {},
      icons: {},
      // The scope this container itself was resolved in: the SubViewport is a
      // child of this node, so its refs name the same pools.
      resources: { externalResources, internalResources },
    }),
    [path, viewport, rtl, externalResources, internalResources]
  );

  const scale = shrinking ? shrink : 1;

  // The render target has only `renderedWidth`x`renderedHeight` pixels, so Godot clips by never
  // rendering past its edge. The Controls arm draws three.js objects with no such edge and needs
  // an explicit clip (`ScrollContainer`'s mechanism). The pixel arm's quad is already this size.
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
            // The cycle branch renders no subtree, so the fallback's slot is its subtree's last.
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
            // Measured in Godot 4.6.3 (`comparison.md`, Item 2): 0.8 grey reads 204, 102 under
            // `self_modulate` 0.5 and 51 with an ancestor `modulate` 0.5 on top, a plain multiply.
            color={tint.color}
            opacity={tint.opacity}
            map={texture}
            renderOrder={renderOrder}
          />
        ) : null}
        {/* `ControlRasterPass` draws a `'dom'` viewport into the texture the quad samples, and only
            the quad carries the tint, so a live draw would composite it twice. This arm serves a
            mixed viewport, whose offscreen pass renders the non-Control half (`viewportContent.ts`). */}
        {contentKind === 'dom' ? null : (
        <ControlCanvasWalker
          tree={tree}
          generation={generation}
          viewport={controlsViewport}
          theme={theme}
          measurer={measureText}
          // `scene/main/viewport.h`: `bool snap_controls_to_pixels = true` on every Viewport, and
          // only the root window receives `gui/common/snap_controls_to_pixels` (`main/main.cpp`), so
          // the project's opt-out never reaches the sub-viewport's Controls.
          snapToPixels
        />
        )}
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
  // The node's own scope, not the ambient provider's: a SubViewportContainer
  // that arrived through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;

  // Raw live children: `solveNode.children` is the Control-only solve forest, and `buildSolveTree`
  // skips a viewport boundary.
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
          // Each successive viewport draws on top of the last (tree-order stacking), a fraction below
          // the next paint index's slot, as a scrollbar grabber's `+0.5` does.
          renderOrder={renderOrder + (index + 1) / 100}
          theme={theme}
          measureText={measureText}
          externalResources={externalResources}
          internalResources={internalResources}
          rtl={solveNode.rtl}
        />
      ))}
    </>
  );
}
