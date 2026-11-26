/**
 * SubViewport: a canvas boundary that is not a world boundary (ADR-0033), and the
 * publisher of its own offscreen render target. Godot resolves `World3D` up to the
 * parent viewport unless `own_world_3d` is set, while `World2D` is always its own,
 * so Node3D descendants draw in the parent's view and CanvasItem descendants do not.
 */

import { lazy, useEffect, useMemo, type ReactNode } from 'react';
import {
  OffscreenViewportPass,
  OwnCanvasWorldScope,
} from '../../../r3f/viewportRender/OffscreenViewportPass';
import { ViewportDescriptionProvider } from '../../../r3f/viewportRender/viewportDescriptionContext';

import type { TscnNode } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { CanvasWorkspaceProvider, useCanvasWorkspace } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { EnclosingViewportProvider } from '../../../r3f/contexts/EnclosingViewportContext';
import { PixelSnapProvider } from '../../../r3f/contexts/PixelSnapContext';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { ViewportSizeProvider } from '../../../r3f/contexts/ViewportSizeContext';
import { LayerRanksProvider } from '../../../r3f/contexts/PaintOrderContext';
import { canvasLayerRanks } from '../../../r3f/canvasPaintOrder';
import { Node } from '../../node/Component';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary';
import { useCanvasModulateColor } from '../../../r3f/canvasModulate';
import { SubViewportCanvasScope } from './SubViewportCanvasScope';
import { useViewportContent } from './useViewportContent';
import { useInheritedRtl } from './useInheritedRtl';
import { useViewportThemeOwners } from '../../windows/window/useViewportThemeOwners';
import { YSortProvider } from '../../../r3f/contexts/YSortContext';
import { PendingSuspense } from '../../../resources/PendingSuspense';
import type { SubViewportProperties } from './types';
import type { Vector2 } from '../../../godot/math/vector';
import { viewportPassSizes, warnOfCappedTarget } from './targetSize';
import { useEmbedderStretchAt } from './useEmbedderStretch';
import { isEmbeddedWindow } from '../../../r3f/viewportRender/viewportBoundary';
import { useStableVector2 } from '../../../r3f/hooks/useStableVector2';
import { useInCanvasOverWorld } from '../../../r3f/viewportRender/canvasOverWorldScope';
import { ViewportCanvasScope } from '../../../r3f/viewportCanvasScope';
import { viewportCanvasColorSpace } from '../../../r3f/viewportRender/viewportTargetOptions';
import { useSubViewportDescription } from '../../../r3f/viewportRender/useSubViewportDescription';
import type { ViewportDescription } from '../../../r3f/viewportRender/viewportDescription';

// Lazy: the Control painters register on import, and a viewport with no Controls never needs them.
const ViewportControls = lazy(() =>
  import('./ViewportControls.js').then((m) => ({ default: m.ViewportControls }))
);

/** The Controls of a viewport beside its 2D items; the climbs above it run only for such a viewport. */
function MixedViewportControls({
  path,
  viewport,
  size,
}: {
  path: string;
  viewport: TscnNode;
  size: Vector2;
}) {
  const inheritedRtl = useInheritedRtl(path);
  const themeOwners = useViewportThemeOwners(path);
  return (
    <ViewportControls
      path={path}
      viewport={viewport}
      size={size}
      inheritedRtl={inheritedRtl}
      themeOwners={themeOwners}
      enclosingViewportSize={null}
    />
  );
}

/**
 * Registered with neither `canvasItem` nor `container`, so `PlainNode` passes it
 * through in the 3D workspace and drops its subtree in the 2D one. `disable_3d` is
 * not read: it leaves the parent view untouched. The subtree mounts once, since a
 * second mount registers a second Object3D at the same path.
 */
export function SubViewport(props: NodeComponentProps) {
  return useInCanvasOverWorld() ? null : <SubViewportMount {...props} />;
}

function SubViewportMount({ node, children }: NodeComponentProps) {
  const description = useSubViewportDescription(node.properties as SubViewportProperties);
  return (
    <ViewportMount node={node} description={description}>
      {children}
    </ViewportMount>
  );
}

/** A viewport and its subtree, drawn by its pass with what `description` gives each render. */
export function ViewportMount({
  node,
  description,
  children,
}: NodeComponentProps & { description: ViewportDescription }) {
  const properties = node.properties as SubViewportProperties;
  const { own_world_3d: ownWorld3D } = properties;
  const workspace = useCanvasWorkspace();
  const path = useNodePath() ?? node.name;
  // Classified over the resolved subtree: in the parsed graph an `instance=`
  // child is a typeless, childless node, so an untouched 2D sub-scene and an
  // untouched 3D one are indistinguishable until the sub-scene lands.
  const { kind, holdsControls, holdsCanvasItems } = useViewportContent(node);
  // Each viewport holds canvases of its own, so its items and Controls rank by its own layers.
  const canvasLayers = useMemo(() => canvasLayerRanks(node.children), [node]);

  // Only content this subsystem can rasterise gets an offscreen pass. A Control-only viewport
  // is the native Control-raster pass's (`ControlRasterPass.tsx`), which clears a viewport with no
  // Control too.
  const rasterizes = kind === '3d' || kind === '2d';

  // With a pass, only 3D content of a shared world in a 3D canvas draws inline. With none, all of it does.
  const rendersInline = rasterizes ? kind === '3d' && !ownWorld3D && workspace === '3d' : true;
  // On either path the subtree's canvas items are in this viewport's World2D, never the parent's.
  // So are its CanvasModulate and its lights: the parent canvas's tint stops at this viewport.
  const stretchOfEmbedder = useEmbedderStretchAt(isEmbeddedWindow(node.type) ? path : null);
  const sizes = viewportPassSizes(node, useViewportRect(path), stretchOfEmbedder);
  // Stable while the numbers are, so the pass and the light host do not follow a new object.
  const size = useStableVector2(sizes.target);
  const renderSize = useStableVector2(sizes.render);
  useEffect(() => warnOfCappedTarget(path, { render: renderSize, target: size }), [path, renderSize, size]);
  // Godot lays Controls out by the visible rect (`viewport.cpp:1202-1216`). Only the target is capped.
  const layoutSize = useStableVector2(sizes.layout);
  const viewSize = useStableVector2(sizes.view);
  const canvasModulate = useCanvasModulateColor(node.children);
  const canvasSpace = viewportCanvasColorSpace(properties);
  // A canvas holds the 2D items and Controls of a viewport, in one tree-order draw. A 2D pass draws
  // it in its portal. A 3D pass draws it over its world, in a scene of its own (`OffscreenViewportPass`),
  // so the world's portal holds the children alone and each workspace drops the other's nodes.
  const inViewport = (inner: ReactNode) => (
    <ViewportSizeProvider size={layoutSize}>
      <LayerRanksProvider value={canvasLayers}>
        <ViewportCanvasScope>
          <SubViewportCanvasScope properties={properties}>{inner}</SubViewportCanvasScope>
        </ViewportCanvasScope>
      </LayerRanksProvider>
    </ViewportSizeProvider>
  );
  // The viewport's own exchange between its y-sorts and its Control walk: its Controls are not the
  // root canvas's, so their runs and origins stay out of that canvas's sort.
  const canvasContents = inViewport(
    <YSortProvider>
      {holdsCanvasItems ? children : null}
      {holdsControls ? (
        <PendingSuspense>
          <MixedViewportControls path={path} viewport={node} size={layoutSize} />
        </PendingSuspense>
      ) : null}
    </YSortProvider>
  );
  // A nested shared viewport draws the nearest own world, as `find_world_3d()` does (`viewport.cpp:4670`).
  function controlOnlyContents() {
    if (!ownWorld3D) return inViewport(children);
    return (
      <ViewportDescriptionProvider description={description}>
        <OwnCanvasWorldScope>
          <CanvasWorkspaceProvider workspace="2d">{inViewport(children)}</CanvasWorkspaceProvider>
        </OwnCanvasWorldScope>
      </ViewportDescriptionProvider>
    );
  }
  const contents =
    kind === '2d' ? canvasContents : kind === 'dom' ? controlOnlyContents() : inViewport(children);
  const drawsCanvasOverWorld = kind === '3d' && (holdsControls || holdsCanvasItems);

  return (
    <Node node={node}>
      <EnclosingViewportProvider path={path}>
        <PixelSnapProvider snaps={properties.snap_2d_transforms_to_pixel}>
          {/* The pass first: of two mounts at one path the last wins, so the world's must be last. */}
          {rasterizes ? (
            <OffscreenViewportPass
              node={node}
              path={path}
              size={size}
              renderSize={renderSize}
              layoutSize={layoutSize}
              viewSize={viewSize}
              kind={kind}
              rendersInline={rendersInline}
              canvasModulate={canvasModulate}
              canvasOverWorld={drawsCanvasOverWorld ? canvasContents : null}
              holdsCanvasItems={holdsCanvasItems}
              viewport={description}
            >
              {rendersInline ? null : contents}
            </OffscreenViewportPass>
          ) : null}
          {rendersInline ? (
            <World2DLightingBoundary canvasModulate={canvasModulate} space={canvasSpace}>
              {contents}
            </World2DLightingBoundary>
          ) : null}
        </PixelSnapProvider>
      </EnclosingViewportProvider>
    </Node>
  );
}
