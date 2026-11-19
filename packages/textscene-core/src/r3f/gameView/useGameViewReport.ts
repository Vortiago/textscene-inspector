import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useResourceLoader } from '../../resources/useResource.js';
import type { Scene } from '../../scene/openScene.js';
import * as logger from '../../logger.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import { pendingSceneWork } from '../sceneWork.js';
import { useGameStartFacts } from './gameStartFacts.js';
import { useGameViewStatus } from './GameViewStatusContext.js';
import type { GameViewSettled } from './gameViewStatus.js';
import type { RootWindow } from './rootWindow.js';

/** The revision the views last heard of, so a frame names what its components rendered. */
function useNoticedRevision(scene: Scene | undefined): number {
  const store = useMemo(() => {
    let noticed = scene?.revision() ?? 0;
    return {
      subscribe: (listener: () => void) =>
        scene
          ? scene.subscribe(() => {
              noticed = scene.revision();
              listener();
            })
          : subscribeToNothing(),
      read: () => noticed,
    };
  }, [scene]);
  return useSyncExternalStore(store.subscribe, store.read);
}

/** Attaches the view to the status, or logs why a second view under one provider reports nothing. */
function useAttachedView(scene: Scene | undefined): { readonly current: boolean } {
  const status = useGameViewStatus();
  const isAttached = useRef(false);
  useEffect(() => {
    if (!status || !scene) return undefined;
    const detach = status.attach(scene);
    if (!detach) {
      logger.error('[GameView] expected one In-game view under a TscnSceneProvider, got a second');
      return undefined;
    }
    isAttached.current = true;
    return () => {
      isAttached.current = false;
      detach();
    };
  }, [status, scene]);
  return isAttached;
}

export function useGameViewReport(
  drawnWindow: RootWindow,
  projectWindow: RootWindow
): (readWindow: () => RgbaImage) => void {
  const status = useGameViewStatus();
  const scene = useOptionalHierarchy()?.scene;
  const loader = useResourceLoader();
  const { scriptedNodeCount, hasCurrentCamera } = useGameStartFacts();
  const facts: GameViewSettled = useMemo(
    () => ({ scriptedNodeCount, hasCurrentCamera }),
    [scriptedNodeCount, hasCurrentCamera]
  );
  const revision = useNoticedRevision(scene);
  const isAttached = useAttachedView(scene);
  return (readWindow) => {
    if (!status || !isAttached.current) return;
    status.frameDrawn({
      revision,
      isFullWindow: drawnWindow === projectWindow,
      work: pendingSceneWork(loader),
      facts,
    });
    if (status.isCaptureDue()) status.capture(readWindow);
  };
}
