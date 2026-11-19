import { useSyncExternalStore } from 'react';
import { useSceneAssetsSettled } from '../../useSceneAssetsSettled.js';
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { subscribeToNothing } from '../../../utils/subscribeToNothing.js';
import { useViewPending } from '../../viewStatus/ViewStatusContext.js';

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
  const { isSettled: areAssetsSettled, pendingTextures } = useSceneAssetsSettled();
  const isGameViewPending = useViewPending();
  const hasScene = currentScene !== null;
  return {
    hasScene,
    isComplete: hasScene && renderedScene === currentScene && areAssetsSettled && !isGameViewPending,
    pendingTextures,
  };
}
