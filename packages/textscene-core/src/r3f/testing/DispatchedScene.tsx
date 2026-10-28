/**
 * The root scene of a scene graph mounted through the dispatcher, as the preview mounts it: the
 * graph's hierarchy, the scene stack over `loader`, then the nodes. Test-only, like the rest of `testing/`.
 */

import type { SceneGraph } from '../../core/SceneGraph';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { NodeDispatcher } from '../NodeDispatcher';
import { SceneStack } from './SceneStack';

export function DispatchedScene({ sceneGraph, loader }: { sceneGraph: SceneGraph; loader: ResourceLoader }) {
  const root = sceneGraph.scenes.get(sceneGraph.rootScene)!;
  return (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <SceneStack loader={loader} scene={root}>
        <NodeDispatcher nodes={root.nodes} />
      </SceneStack>
    </HierarchyProvider>
  );
}
