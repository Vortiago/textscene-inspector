import { lazy } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useSeatedRoots } from './useLiveSceneTree.js';
import { useViewShow } from './viewShow/ViewShowContext.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { EditedRootProvider } from './contexts/InstanceOwnersContext.js';
import { NodeDispatcher } from './NodeDispatcher.js';
import { SelectionHighlight } from './components/SelectionHighlight.js';
import { PendingSuspense } from '../resources/PendingSuspense.js';
import { editorHelperUserData } from './editorHelpers.js';
import { WorldEnvironmentScope } from './environment/WorldEnvironmentScope.js';
import { ControlRasterLayer } from '../nodes/viewport/subviewport/ControlRasterLayer.js';
import { SceneShadowFitter } from './SceneShadowFitter.js';
import { SceneDepthPrepass } from './depthPrepass/SceneDepthPrepass.js';
import { CanvasRendererScope } from './canvasRenderer/CanvasRendererScope.js';

// Lazy, so the glyph engine and the parse of the prompt load only for an empty canvas.
const EmptyScenePrompt = lazy(() => import('./emptyScenePrompt.js'));

/** What the 3D stage's canvas draws of the scene. With no `HierarchyContext` it draws the empty scene. */
export function TscnSceneContents() {
  const { rootScene, nodes } = useRootScene();
  // A grid and a prompt, since an empty black canvas looks like a renderer crash.
  const isEmpty = nodes === null || nodes.length === 0;

  return (
    <CanvasRendererScope>
      {/* Godot's editor preview sun and environment, while the scene has none of its own (ADR-0025). */}
      <WorldEnvironmentScope world="root">
        {isEmpty && <EmptySceneIndicator />}
        {!isEmpty && <ContentGroundGrid />}
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

/** The 10-unit grid frames no mesh-free scene, such as a lone Path3D, and a SubViewport draws none of it. */
function GroundGrid() {
  return <gridHelper args={[10, 10, 0x444444, 0x222222]} userData={GROUND_GRID_USER_DATA} />;
}

/** One object, as R3F assigns a new `userData` object on each render. */
const GROUND_GRID_USER_DATA = { tscnEmptyState: true, ...editorHelperUserData() };

/** A child component, so a change of `show` re-renders this and not the node tree. */
function ContentGroundGrid() {
  const { grid } = useViewShow();
  return grid ? <GroundGrid /> : null;
}

function EmptySceneIndicator() {
  // paint-order-safe: mounted where no scene, and so no canvas item, exists.
  return (
    <group userData={{ tscnEmptyState: true }}>
      <GroundGrid />
      <PendingSuspense>
        <EmptyScenePrompt />
      </PendingSuspense>
    </group>
  );
}
