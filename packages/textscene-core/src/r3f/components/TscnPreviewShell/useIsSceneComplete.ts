/**
 * Whether a frame now would show the current scene whole: the shell has a scene, the canvas has
 * rendered it, and no resource or texture it uses is still on its way.
 */
import { useSyncExternalStore } from 'react';
import { usePendingResourceCount } from '../../../resources/usePendingResourceCount.js';
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';

const NO_SUBSCRIPTION = () => () => {};
const NO_SCENE = () => null;

export function useIsSceneComplete(): boolean {
  const control = useOptionalViewportActions();
  const currentScene = useOptionalHierarchy()?.sceneGraph ?? null;
  const renderedScene = useSyncExternalStore(
    control?.subscribeScreenshotHandler ?? NO_SUBSCRIPTION,
    control?.screenshotScene ?? NO_SCENE
  );
  // Every hook runs on every render, so React sees one hook order.
  const pendingResources = usePendingResourceCount();
  const pendingTextures = usePendingTextureWork();
  return (
    currentScene !== null && renderedScene === currentScene && pendingResources === 0 && pendingTextures === 0
  );
}
