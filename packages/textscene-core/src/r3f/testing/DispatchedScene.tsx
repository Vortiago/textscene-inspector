/**
 * The root scene of a scene graph mounted through the dispatcher, as the preview mounts it: the
 * graph's hierarchy, the scene stack over `loader`, the y-sort of the canvas, then the nodes. Test-only, like the rest of `testing/`.
 */

import type { ReactNode } from 'react';
import type { SceneGraph } from '../../core/SceneGraph';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { NodeDispatcher } from '../NodeDispatcher';
import { YSortProvider } from '../contexts/YSortContext';
import { SceneStack, type SceneStackProps } from './SceneStack';
import { ControlCanvasLayer } from '../controls/index';

export interface DispatchedSceneProps extends Pick<
  SceneStackProps,
  'loader' | 'workspace' | 'selectedPath' | 'showGizmos'
> {
  sceneGraph: SceneGraph;
  /** A provider the nodes mount inside, under the hierarchy and the stack. Omitted, the nodes mount bare. */
  around?: (nodes: ReactNode) => ReactNode;
  /** Whether the Control walk draws beside the nodes, as the 2D stage mounts it. */
  drawsControls?: boolean;
}

export function DispatchedScene({
  sceneGraph,
  around = (nodes) => nodes,
  drawsControls = false,
  ...stack
}: DispatchedSceneProps) {
  const root = sceneGraph.scenes.get(sceneGraph.rootScene);
  if (!root) throw new Error(`expected the root scene ${sceneGraph.rootScene} in the graph, got none`);
  return (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <SceneStack {...stack} scene={root}>
        <YSortProvider>
          {around(<NodeDispatcher nodes={root.nodes} />)}
          {drawsControls && <ControlCanvasLayer nodes={root.nodes} />}
        </YSortProvider>
      </SceneStack>
    </HierarchyProvider>
  );
}
