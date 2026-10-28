/**
 * The root scene of a scene graph mounted through the dispatcher, as the preview mounts it: the
 * graph's hierarchy, the scene stack over `loader`, then the nodes. Test-only, like the rest of `testing/`.
 */

import type { ReactNode } from 'react';
import type { SceneGraph } from '../../core/SceneGraph';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { NodeDispatcher } from '../NodeDispatcher';
import { SceneStack, type SceneStackProps } from './SceneStack';

export interface DispatchedSceneProps extends Pick<SceneStackProps, 'loader' | 'workspace' | 'selectedPath'> {
  sceneGraph: SceneGraph;
  /** A provider the nodes mount inside, under the hierarchy and the stack. Omitted, the nodes mount bare. */
  around?: (nodes: ReactNode) => ReactNode;
}

export function DispatchedScene({ sceneGraph, around = (nodes) => nodes, ...stack }: DispatchedSceneProps) {
  const root = sceneGraph.scenes.get(sceneGraph.rootScene);
  if (!root) throw new Error(`expected the root scene ${sceneGraph.rootScene} in the graph, got none`);
  return (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <SceneStack {...stack} scene={root}>
        {around(<NodeDispatcher nodes={root.nodes} />)}
      </SceneStack>
    </HierarchyProvider>
  );
}
