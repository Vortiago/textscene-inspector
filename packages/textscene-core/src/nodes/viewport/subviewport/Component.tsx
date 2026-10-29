/**
 * SubViewport: a canvas boundary that is not a world boundary (ADR-0033), and the
 * publisher of its own offscreen render target. Godot resolves `World3D` up to the
 * parent viewport unless `own_world_3d` is set, while `World2D` is always its own,
 * so Node3D descendants draw in the parent's view and CanvasItem descendants do not.
 */

import { lazy, useMemo, type ReactNode } from 'react';
import { OffscreenViewportPass } from './OffscreenViewportPass';

import type { TscnNode } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useCanvasWorkspace } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { EnclosingViewportProvider } from '../../../r3f/contexts/EnclosingViewportContext';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { ViewportSizeProvider } from '../../../r3f/contexts/ViewportSizeContext';
import { Node } from '../../node/Component';
import { World2DLightingBoundary } from '../../../r3f/lighting2d/World2DLightingBoundary';
import { useCanvasModulateColor } from '../../../r3f/canvasModulate';
import { SubViewportSamplerScope } from './SubViewportSamplerScope';
import { useViewportContent } from './useViewportContent';
import { useInheritedRtl } from './useInheritedRtl';
import { PendingSuspense } from '../../../resources/PendingSuspense';
import type { SubViewportProperties } from './types';
import type { Vector2 } from '../../../godot/math/vector';
import { viewportSize, viewportTargetSize } from './targetSize';

// Lazy: the Control painters register on import, and a viewport with no Controls never needs them.
const ViewportControls = lazy(() =>
  import('./ViewportControls.js').then((m) => ({ default: m.ViewportControls }))
);

/** The Controls of a viewport beside its 2D items; the direction climb runs only for such a viewport. */
function MixedViewportControls({
  path,
  nodes,
  size,
}: {
  path: string;
  nodes: readonly TscnNode[];
  size: Vector2;
}) {
  const inheritedRtl = useInheritedRtl(path);
  return <ViewportControls nodes={nodes} size={size} inheritedRtl={inheritedRtl} />;
}

/**
 * Registered with neither `canvasItem` nor `container`, so `PlainNode` passes it
 * through in the 3D workspace and drops its subtree in the 2D one. `disable_3d` is
 * not read: it leaves the parent view untouched. The subtree mounts once, since a
 * second mount registers a second Object3D at the same path.
 */
export function SubViewport({ node, children }: NodeComponentProps) {
  const properties = node.properties as SubViewportProperties;
  const { own_world_3d: ownWorld3D } = properties;
  const workspace = useCanvasWorkspace();
  const path = useNodePath() ?? node.name;
  // Classified over the resolved subtree: in the parsed graph an `instance=`
  // child is a typeless, childless node, so an untouched 2D sub-scene and an
  // untouched 3D one are indistinguishable until the sub-scene lands.
  const { kind, holdsControls, holdsCanvasItems } = useViewportContent(node);

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
  const forcedRect = useViewportRect(path);
  const targetSize = viewportTargetSize(properties.size, forcedRect);
  const authoredSize = viewportSize(properties.size, forcedRect);
  // Stable while the numbers are, so the pass and the light host do not follow a new object.
  const size = useMemo(() => ({ x: targetSize.x, y: targetSize.y }), [targetSize.x, targetSize.y]);
  // Godot lays Controls out by `size` (`viewport.cpp:1202-1210`); only the target is capped.
  const layoutSize = useMemo(
    () => ({ x: authoredSize.x, y: authoredSize.y }),
    [authoredSize.x, authoredSize.y]
  );
  const canvasModulate = useCanvasModulateColor(node.children);
  // A canvas holds the 2D items and Controls of a viewport, in one tree-order draw. A 2D pass draws
  // it in its portal. A 3D pass draws it over its world, in a scene of its own (`OffscreenViewportPass`),
  // so the world's portal holds the children alone and each workspace drops the other's nodes.
  const inViewport = (inner: ReactNode) => (
    <ViewportSizeProvider size={layoutSize}>
      <SubViewportSamplerScope properties={properties}>{inner}</SubViewportSamplerScope>
    </ViewportSizeProvider>
  );
  const canvasContents = inViewport(
    <>
      {holdsCanvasItems ? children : null}
      {holdsControls ? (
        <PendingSuspense>
          <MixedViewportControls path={path} nodes={node.children} size={layoutSize} />
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
            kind={kind}
            rendersInline={rendersInline}
            canvasModulate={canvasModulate}
            canvasOverWorld={drawsCanvasOverWorld ? canvasContents : null}
            holdsCanvasItems={holdsCanvasItems}
          >
            {rendersInline ? null : contents}
          </OffscreenViewportPass>
        ) : null}
        {rendersInline ? (
          <World2DLightingBoundary canvasModulate={canvasModulate}>{contents}</World2DLightingBoundary>
        ) : null}
      </EnclosingViewportProvider>
    </Node>
  );
}
