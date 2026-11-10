/**
 * SubViewport: a canvas boundary that is not a world boundary (ADR-0033), and the
 * publisher of its own offscreen render target. Godot resolves `World3D` up to the
 * parent viewport unless `own_world_3d` is set, while `World2D` is always its own,
 * so Node3D descendants draw in the parent's view and CanvasItem descendants do not.
 */

import { lazy, useMemo, type ReactNode } from 'react';
import { OffscreenViewportPass } from './OffscreenViewportPass';
import { GateOnlyPass } from './GateOnlyPass';

import type { TscnNode } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useCanvasWorkspace } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { EnclosingViewportProvider } from '../../../r3f/contexts/EnclosingViewportContext';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { ViewportSizeProvider, useEmbedderViewportSize } from '../../../r3f/contexts/ViewportSizeContext';
import { LayerRanksProvider } from '../../../r3f/contexts/PaintOrderContext';
import { canvasLayerRanks } from '../../../r3f/canvasPaintOrder';
import { Node } from '../../node/Component';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary';
import { useCanvasModulateColor } from '../../../r3f/canvasModulate';
import { SubViewportCanvasScope } from './SubViewportCanvasScope';
import { useViewportContent } from './useViewportContent';
import { useInheritedRtl } from './useInheritedRtl';
import { useViewportThemeOwners } from '../../windows/window/useViewportThemeOwners';
import { PendingSuspense } from '../../../resources/PendingSuspense';
import type { SubViewportProperties } from './types';
import type { Vector2 } from '../../../godot/math/vector';
import { viewportPassSizes } from './targetSize';
import { useStableVector2 } from '../../../r3f/hooks/useStableVector2';
import { useInCanvasOverWorld } from './canvasOverWorldScope';
import { ViewportCanvasScope } from '../../../r3f/viewportCanvasScope';
import { viewportCanvasColorSpace } from './offscreenViewport';

// Lazy: the Control painters register on import, and a viewport with no Controls never needs them.
const ViewportControls = lazy(() =>
  import('./ViewportControls.js').then((m) => ({ default: m.ViewportControls }))
);

/** The Controls of a viewport beside its 2D items; the climbs above it run only for such a viewport. */
function MixedViewportControls({
  path,
  viewport,
  size,
  embedsWindows,
}: {
  path: string;
  viewport: TscnNode;
  size: Vector2;
  embedsWindows: boolean;
}) {
  const inheritedRtl = useInheritedRtl(path);
  const themeOwners = useViewportThemeOwners(path);
  const enclosingViewportSize = useEmbedderViewportSize();
  return (
    <ViewportControls
      path={path}
      viewport={viewport}
      size={size}
      inheritedRtl={inheritedRtl}
      themeOwners={themeOwners}
      enclosingViewportSize={enclosingViewportSize}
      embedsWindows={embedsWindows}
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
  // is the native Control-raster pass's (`ControlRasterPass.tsx`), and an empty one has nothing
  // to draw.
  const rasterizes = kind === '3d' || kind === '2d';

  // The subtree draws inline only for 3D content in a shared world in a 3D
  // canvas. Otherwise the offscreen pass portals it. Without a pass, the children
  // pass through on the `own_world_3d` rule, since a component renders what the
  // dispatcher hands it (subtreeConformance).
  const rendersInline = rasterizes ? kind === '3d' && !ownWorld3D && workspace === '3d' : !ownWorld3D;
  // On either path the subtree's canvas items are in this viewport's World2D, never the parent's.
  // So are its CanvasModulate and its lights: the parent canvas's tint stops at this viewport.
  const sizes = viewportPassSizes(node, useViewportRect(path));
  // Stable while the numbers are, so the pass and the light host do not follow a new object.
  const size = useStableVector2(sizes.target);
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
  const canvasContents = inViewport(
    <>
      {holdsCanvasItems ? children : null}
      {holdsControls ? (
        <PendingSuspense>
          <MixedViewportControls
            path={path}
            viewport={node}
            size={layoutSize}
            embedsWindows={properties.gui_embed_subwindows}
          />
        </PendingSuspense>
      ) : null}
    </>
  );
  const contents = kind === '2d' ? canvasContents : inViewport(children);
  const drawsCanvasOverWorld = kind === '3d' && (holdsControls || holdsCanvasItems);

  return (
    <Node node={node}>
      <EnclosingViewportProvider path={path}>
        {/* The pass first: a container both workspaces mount registers its path twice, and the
            last mount wins, which must be the world's (`SelectionContext.registerNodeObject`). */}
        {rasterizes ? (
          <OffscreenViewportPass
            node={node}
            path={path}
            size={size}
            layoutSize={layoutSize}
            viewSize={viewSize}
            kind={kind}
            rendersInline={rendersInline}
            canvasModulate={canvasModulate}
            canvasOverWorld={drawsCanvasOverWorld ? canvasContents : null}
            holdsCanvasItems={holdsCanvasItems}
          >
            {rendersInline ? null : contents}
          </OffscreenViewportPass>
        ) : null}
        {kind === 'empty' ? <GateOnlyPass node={node} path={path} /> : null}
        {rendersInline ? (
          <World2DLightingBoundary canvasModulate={canvasModulate} space={canvasSpace}>
            {contents}
          </World2DLightingBoundary>
        ) : null}
      </EnclosingViewportProvider>
    </Node>
  );
}
