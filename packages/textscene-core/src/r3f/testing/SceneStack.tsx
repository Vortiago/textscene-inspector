/**
 * The providers a component test mounts a parsed scene inside, outermost first: the canvas
 * workspace when one is given, the Gizmos toggle when one is given, the resource loader, the scene's
 * own resources and the selection.
 * One stack, so a provider every such test needs is added here once. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import { useMemo, type ReactNode } from 'react';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { EditedRootProvider } from '../contexts/InstanceOwnersContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewShowProvider } from '../viewShow/ViewShowContext';
import { SceneResourcesProvider, type SceneResourcesProviderProps } from '../SceneResourcesContext';
import { SelectSeeder } from './SelectSeeder';
import { HierarchyProvider, useOptionalHierarchy } from '../contexts/HierarchyContext';
import { useOpenedScene } from '../hooks/useOpenedScene';
import { DEFAULT_ROOT_SCENE_PATH } from '../../scene/openScene';

export interface SceneStackProps {
  /**
   * The sub-resources and external resources the stack provides: a whole parsed scene, or either
   * array alone. An omitted array reaches SceneResourcesProvider as `undefined`, so its stable
   * empty default holds. A parsed scene's `[editable]` paths decide which instances count as editable.
   */
  scene: Pick<SceneResourcesProviderProps, 'internalResources' | 'externalResources'> & {
    editableInstances?: readonly string[];
  };
  loader: ResourceLoader;
  /** The workspace the canvas draws. Omitted, no workspace provider mounts: the default holds. */
  workspace?: CanvasWorkspace;
  /** The node path selected once mounted. Defaults to none. */
  selectedPath?: string | null;
  /** The Gizmos toggle. Omitted, no viewport provider mounts: the toggle is on. */
  showGizmos?: boolean;
  /** The text of `scene`, opened as the views open it, for a test of its current cameras. */
  source?: string;
  children: ReactNode;
}

/** The graph stays the test's: the scene takes a new text a commit after the nodes the test draws. */
function OpenedScene({ source, children }: { source: string; children: ReactNode }) {
  const scene = useOpenedScene(source, DEFAULT_ROOT_SCENE_PATH);
  const outer = useOptionalHierarchy();
  const value = useMemo(
    () => ({ sceneGraph: outer?.sceneGraph ?? null, panelId: outer?.panelId ?? 'scene-stack', scene }),
    [outer, scene]
  );
  return <HierarchyProvider value={value}>{children}</HierarchyProvider>;
}

export function SceneStack({
  scene,
  loader,
  workspace,
  selectedPath = null,
  showGizmos,
  source,
  children,
}: SceneStackProps) {
  const stack = (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={scene.internalResources}
        externalResources={scene.externalResources}
      >
        <EditedRootProvider editableInstances={scene.editableInstances}>
          <SelectionProvider>
            {selectedPath !== null && <SelectSeeder path={selectedPath} />}
            {source === undefined ? children : <OpenedScene source={source}>{children}</OpenedScene>}
          </SelectionProvider>
        </EditedRootProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const toggled =
    showGizmos === undefined ? (
      stack
    ) : (
      <ViewShowProvider show={{ gizmos: showGizmos }}>{stack}</ViewShowProvider>
    );
  if (workspace === undefined) return toggled;
  return <CanvasWorkspaceProvider workspace={workspace}>{toggled}</CanvasWorkspaceProvider>;
}
