import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useResourceLoader } from '../../resources/useResource.js';
import type { Scene } from '../../scene/openScene.js';
import * as logger from '../../logger.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { hasPendingWork, pendingSceneWork } from '../sceneWork.js';
import type { ResourceLoader } from '../../resources/ResourceLoader.js';
import { textureWork } from '../../resources/textures/textureWork.js';
import { fontWork } from '../controls/native/text/settledChannel.js';
import { useGameStartFacts } from '../gameView/gameStartFacts.js';
import { useViewStatusStore } from './ViewStatusContext.js';
import type { DrawnFrame, ViewSettled, ViewStatusStore } from './viewStatus.js';

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

/** Attaches the view to the status, or logs why a second view on one status reports nothing. */
function useAttachedView(scene: Scene | undefined): { readonly current: boolean } {
  const store = useViewStatusStore();
  const isAttached = useRef(false);
  useEffect(() => {
    if (!store || !scene) return undefined;
    const detach = store.attach(scene);
    if (!detach) {
      logger.error('[View] expected one view per view status, got a second');
      return undefined;
    }
    isAttached.current = true;
    return () => {
      isAttached.current = false;
      detach();
    };
  }, [store, scene]);
  return isAttached;
}

/** Reports each frame the view draws. `isFullSize`: the frame drew at the size a capture reads. */
export function useViewReport(): (isFullSize: boolean, awaitedCamera?: string | null) => void {
  const store = useViewStatusStore();
  const scene = useOptionalHierarchy()?.scene;
  const loader = useResourceLoader();
  const { scriptedNodeCount, hasCurrentCamera } = useGameStartFacts();
  const facts = useMemo<ViewSettled>(
    () => ({ scriptedNodeCount, hasCurrentCamera }),
    [scriptedNodeCount, hasCurrentCamera]
  );
  const revision = useNoticedRevision(scene);
  const isAttached = useAttachedView(scene);
  // One record per view, filled in place each frame: the status reads only the last one.
  const [frame] = useState<DrawnFrame>(() => ({
    revision: 0,
    isFullSize: false,
    awaitedCamera: null,
    work: { resources: 0, textures: 0, fonts: 0 },
    facts,
  }));
  useReportStartedWork(store, isAttached, loader, frame);
  return (isFullSize, awaitedCamera = null) => {
    if (!store || !isAttached.current) return;
    frame.revision = revision;
    frame.isFullSize = isFullSize;
    frame.awaitedCamera = awaitedCamera;
    pendingSceneWork(loader, frame.work);
    frame.facts = facts;
    store.frameDrawn(frame);
  };
}

/** A load can start or end while no frame draws, so the status hears of it at once. Only a drawn frame settles. */
function useReportStartedWork(
  store: ViewStatusStore | null,
  isAttached: { readonly current: boolean },
  loader: ResourceLoader | null,
  frame: DrawnFrame
): void {
  useEffect(() => {
    if (!store) return undefined;
    const onWorkChange = () => {
      if (!isAttached.current) return;
      const work = pendingSceneWork(loader);
      store.workChanged(work);
      // The status reads the last frame in place, so the record changes only to report work.
      if (!hasPendingWork(work)) return;
      frame.work = work;
      store.frameDrawn(frame);
    };
    const stops = [
      loader?.subscribePending(onWorkChange),
      textureWork.subscribe(onWorkChange),
      fontWork.subscribe(onWorkChange),
    ];
    return () => stops.forEach((stop) => stop?.());
  }, [store, isAttached, loader, frame]);
}
