/**
 * The canvas space a Control gives the Node2D items below it. The world walk draws no Control, so
 * this puts back what the Control hands its children. The Control walk solves where the Control's
 * canvas item sits and publishes that transform (`YSortContext`), and this group applies it,
 * as `get_global_transform()` composes (`control.cpp:719-737`, `canvas_item.cpp:176-186`). A hidden
 * Control hides them too (`canvas_item.cpp:62-64`), with the `visible` its container writes onto it
 * (`tab_container.cpp:377-399`, `foldable_container.cpp:376-386`). Its modulate, z, material and sampler reach them
 * as any parent item's do (`renderer_canvas_cull.cpp:319-326`, `:430-434`).
 */
import { useMemo, type ReactNode } from 'react';
import type { CanvasItemPassResult } from './canvasItemPass/canvasItemPass.js';
import { canvasItemPass } from './canvasItemPass/canvasItemPass.js';
import { useLiveScenePassSelection } from './liveScenePass.js';
import type { TscnNode } from '../parser/types';
import { isControlType } from './canvasItemClass.js';
import type { ControlProperties } from '../nodes/2d/ui/control/types.js';
import { useCanvasItemVisible } from './canvasItemVisible.js';
import { useControlTransform } from './contexts/YSortContext.js';
import { threeMatrixFromTransform2D } from './node2dTransform.js';
import { useSceneResources } from './SceneResourcesContext.js';
import { CanvasParentProvider, useDrawnCanvasItem } from './canvasItemPass/inheritedCanvasState.js';

interface ControlCanvasSpaceProps {
  node: TscnNode;
  /** The live path of `node`, which keys the published transform. */
  path: string;
  children: ReactNode;
}

function SolvedControlSpace({ node, path, children }: ControlCanvasSpaceProps) {
  const transform = useControlTransform(path);
  const matrix = useMemo(() => transform && threeMatrixFromTransform2D(transform), [transform]);
  const isVisible = useCanvasItemVisible(
    path,
    useWrittenVisible(path) ?? (node.properties as ControlProperties).visible
  );
  const { handedDown } = useDrawnCanvasItem(node, path, useSceneResources());
  // paint-order-safe: outside every keyed item group, it only moves and hides the Node2D items below.
  return (
    <group visible={isVisible} matrix={matrix ?? undefined} matrixAutoUpdate={matrix === null}>
      <CanvasParentProvider value={handedDown}>{children}</CanvasParentProvider>
    </group>
  );
}

/** The `visible` the container of the Control at `path` writes onto it, or undefined. */
function useWrittenVisible(path: string): boolean | undefined {
  const select = useMemo(
    () => (results: ReadonlyMap<string, CanvasItemPassResult>) => results.get(path)?.writtenVisible,
    [path]
  );
  return useLiveScenePassSelection(canvasItemPass, select, Object.is);
}

/** `children` as they are for a node that is no Control, which has no such space. */
export function ControlCanvasSpace({ node, path, children }: ControlCanvasSpaceProps) {
  if (!isControlType(node.type)) return <>{children}</>;
  return (
    <SolvedControlSpace node={node} path={path}>
      {children}
    </SolvedControlSpace>
  );
}
