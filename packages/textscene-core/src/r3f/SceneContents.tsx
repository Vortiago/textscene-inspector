import type { ReactNode } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useSeatedRoots } from './useLiveSceneTree.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { EditedRootProvider } from './contexts/InstanceOwnersContext.js';
import { NodeDispatcher } from './NodeDispatcher.js';
import { SelectionHighlight } from './components/SelectionHighlight.js';
import { WorldEnvironmentScope } from './environment/WorldEnvironmentScope.js';
import { ControlRasterLayer } from '../nodes/viewport/subviewport/ControlRasterLayer.js';
import { SceneShadowFitter } from './SceneShadowFitter.js';
import { SceneDepthPrepass } from './depthPrepass/SceneDepthPrepass.js';
import { CanvasRendererScope } from './canvasRenderer/CanvasRendererScope.js';

/** What the 3D stage's canvas draws of the scene, with the editor's parts as `children`. */
export function TscnSceneContents({ children }: { children?: ReactNode }) {
  const { rootScene, nodes } = useRootScene();

  return (
    <CanvasRendererScope>
      {/* Godot's editor preview sun and environment, while the scene has none of its own (ADR-0025). */}
      <WorldEnvironmentScope world="root">
        {children}
        {nodes && rootScene && (
          <SceneResourcesProvider
            internalResources={rootScene.internalResources}
            externalResources={rootScene.externalResources}
          >
            <EditedRootProvider editableInstances={rootScene.editableInstances}>
              <NodeDispatcher nodes={nodes} />
            </EditedRootProvider>
          </SceneResourcesProvider>
        )}
        <ControlRasterLayer
          nodes={nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
        />
        <SceneShadowFitter />
        <SceneDepthPrepass />
        <SelectionHighlight />
      </WorldEnvironmentScope>
    </CanvasRendererScope>
  );
}

/** The root scene of the scene the view reads, and its seated roots: null before the scene loads. */
export function useRootScene() {
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  return { rootScene, nodes: useSeatedRoots() ?? null };
}
