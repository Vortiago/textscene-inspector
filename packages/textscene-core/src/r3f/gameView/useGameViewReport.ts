import { useEffect, useMemo } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { subscribeToCameras, useCurrentCamera2D, useCurrentCamera3D } from '../currentCamera.js';
import { useResourceLoader } from '../../resources/useResource.js';
import type { Scene } from '../../scene/openScene.js';
import { pendingSceneWork } from '../sceneWork.js';
import { useGameStartFacts } from './gameStartFacts.js';
import { useGameViewStatus } from './GameViewStatusContext.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import type { GameViewSettled, LiveScene } from './gameViewStatus.js';
import type { RootWindow } from './rootWindow.js';

function liveSceneOf(scene: Scene): LiveScene {
  return {
    state: () => [scene.written(), scene.currentCamera3D(null), scene.currentCamera2D(null)],
    subscribe: (listener) => subscribeToCameras(scene, listener),
  };
}

export function useGameViewReport(
  drawnWindow: RootWindow,
  projectWindow: RootWindow
): (readWindow: () => RgbaImage) => void {
  const status = useGameViewStatus();
  const hierarchy = useOptionalHierarchy();
  const sceneGraph = hierarchy?.sceneGraph ?? null;
  const scene = hierarchy?.scene;
  const loader = useResourceLoader();
  const { scriptedNodeCount, hasCurrentCamera } = useGameStartFacts();
  const facts: GameViewSettled = useMemo(
    () => ({ scriptedNodeCount, hasCurrentCamera }),
    [scriptedNodeCount, hasCurrentCamera]
  );
  const camera3D = useCurrentCamera3D(ROOT_VIEWPORT_PATH);
  const camera2D = useCurrentCamera2D(ROOT_VIEWPORT_PATH);
  const shown = useMemo(() => [sceneGraph, camera3D, camera2D], [sceneGraph, camera3D, camera2D]);
  useEffect(() => (scene ? status?.attach(liveSceneOf(scene)) : undefined), [status, scene]);
  return (readWindow) => {
    if (!status) return;
    status.frameDrawn({
      shown,
      window: drawnWindow,
      isFullWindow: drawnWindow === projectWindow,
      work: pendingSceneWork(loader),
      facts,
    });
    if (status.isCaptureDue()) status.capture(readWindow);
  };
}
