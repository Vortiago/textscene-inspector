/**
 * How far the current scene has loaded. It is complete when a frame now would show it whole: the
 * shell has a scene, the canvas has rendered it, and no resource or texture it uses is still on
 * its way.
 */
import { useSyncExternalStore } from 'react';
import { usePendingResourceCount } from '../../../resources/usePendingResourceCount.js';
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { subscribeToNothing } from '../../../utils/subscribeToNothing.js';

const NO_SCENE = () => null;

export interface SceneLoad {
  hasScene: boolean;
  isComplete: boolean;
  pendingTextures: number;
}

export function useSceneLoad(): SceneLoad {
  const control = useOptionalViewportActions();
  const currentScene = useOptionalHierarchy()?.sceneGraph ?? null;
  const renderedScene = useSyncExternalStore(
    control?.subscribeScreenshotHandler ?? subscribeToNothing,
    control?.screenshotScene ?? NO_SCENE
  );
  // Every hook runs on every render, so React sees one hook order.
  const pendingResources = usePendingResourceCount();
  const pendingTextures = usePendingTextureWork();
  const hasScene = currentScene !== null;
  return {
    hasScene,
    isComplete: hasScene && renderedScene === currentScene && pendingResources === 0 && pendingTextures === 0,
    pendingTextures,
  };
}
