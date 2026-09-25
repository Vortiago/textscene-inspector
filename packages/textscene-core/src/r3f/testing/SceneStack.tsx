/**
 * The providers a component test mounts a parsed scene inside, outermost first: the canvas
 * workspace when one is given, the resource loader, the scene's own resources and the selection.
 * One stack, so a provider every such test needs is added here once. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import type { ReactNode } from 'react';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { SceneResourcesProvider, type SceneResourcesProviderProps } from '../SceneResourcesContext';
import { SelectSeeder } from './SelectSeeder';

export interface SceneStackProps {
  /**
   * The sub-resources and external resources the stack provides: a whole parsed scene, or either
   * array alone. An omitted array reaches SceneResourcesProvider as `undefined`, so its stable
   * empty default holds.
   */
  scene: Pick<SceneResourcesProviderProps, 'internalResources' | 'externalResources'>;
  loader: ResourceLoader;
  /** The workspace the canvas draws. Omitted, no workspace provider mounts: the default holds. */
  workspace?: CanvasWorkspace;
  /** The node path selected once mounted. Defaults to none. */
  selectedPath?: string | null;
  children: ReactNode;
}

export function SceneStack({
  scene,
  loader,
  workspace,
  selectedPath = null,
  children,
}: SceneStackProps) {
  const stack = (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={scene.internalResources}
        externalResources={scene.externalResources}
      >
        <SelectionProvider>
          {selectedPath !== null && <SelectSeeder path={selectedPath} />}
          {children}
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  if (workspace === undefined) return stack;
  return <CanvasWorkspaceProvider workspace={workspace}>{stack}</CanvasWorkspaceProvider>;
}
