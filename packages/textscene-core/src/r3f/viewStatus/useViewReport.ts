import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useResourceLoader } from '../../resources/useResource.js';
import type { Scene } from '../../scene/openScene.js';
import * as logger from '../../logger.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { pendingSceneWork } from '../sceneWork.js';
import { useGameStartFacts } from '../gameView/gameStartFacts.js';
import { useViewStatus } from './ViewStatusContext.js';
import type { DrawnFrame, ViewSettled } from './viewStatus.js';

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
  const status = useViewStatus();
  const isAttached = useRef(false);
  useEffect(() => {
    if (!status || !scene) return undefined;
    const detach = status.attach(scene);
    if (!detach) {
      logger.error('[View] expected one view under a TscnSceneProvider, got a second');
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

/** Reports each frame the view draws. `isFullSize`: the frame drew at the size a capture reads. */
export function useViewReport(): (isFullSize: boolean) => void {
  const status = useViewStatus();
  const scene = useOptionalHierarchy()?.scene;
  const loader = useResourceLoader();
  const { scriptedNodeCount, hasCurrentCamera } = useGameStartFacts();
  const facts: ViewSettled = useMemo(
    () => ({ scriptedNodeCount, hasCurrentCamera }),
    [scriptedNodeCount, hasCurrentCamera]
  );
  const revision = useNoticedRevision(scene);
  const isAttached = useAttachedView(scene);
  // One record per view, filled in place each frame: the status reads only the last one.
  const [frame] = useState<DrawnFrame>(() => ({
    revision: 0,
    isFullSize: false,
    work: { resources: 0, textures: 0, fonts: 0 },
    facts,
  }));
  return (isFullSize) => {
    if (!status || !isAttached.current) return;
    frame.revision = revision;
    frame.isFullSize = isFullSize;
    pendingSceneWork(loader, frame.work);
    frame.facts = facts;
    status.frameDrawn(frame);
  };
}
