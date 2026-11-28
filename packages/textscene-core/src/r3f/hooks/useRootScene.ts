import { useWrittenGraph } from '../contexts/HierarchyContext.js';
import { useSeatedRoots } from '../useLiveSceneTree.js';

/** The root scene of the scene the view reads, and its seated roots: null before the scene loads. */
export function useRootScene() {
  const sceneGraph = useWrittenGraph();
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  return { rootScene, nodes: useSeatedRoots() ?? null };
}
