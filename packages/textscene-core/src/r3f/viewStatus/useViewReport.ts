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
import { useViewStatus } from './ViewStatusContext.js';
import type { DrawnFrame, ViewSettled, ViewStatus } from './viewStatus.js';

const NO_FILES: ReadonlySet<string> = new Set();

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
export function useViewReport(): (isFullSize: boolean, awaitedCamera?: string | null) => void {
  const status = useViewStatus();
  const scene = useOptionalHierarchy()?.scene;
  const loader = useResourceLoader();
  const { scriptedNodeCount, hasCurrentCamera } = useGameStartFacts();
  const settledFacts = useMemo(() => {
    let last: ViewSettled | null = null;
    // Read as the frame draws, since a reader reports a failed file in an effect after its render.
    return (missingFiles: ReadonlySet<string>): ViewSettled => {
      if (last?.missingFiles !== missingFiles) last = { scriptedNodeCount, hasCurrentCamera, missingFiles };
      return last;
    };
  }, [scriptedNodeCount, hasCurrentCamera]);
  const revision = useNoticedRevision(scene);
  const isAttached = useAttachedView(scene);
  // One record per view, filled in place each frame: the status reads only the last one.
  const [frame] = useState<DrawnFrame>(() => ({
    revision: 0,
    isFullSize: false,
    awaitedCamera: null,
    work: { resources: 0, textures: 0, fonts: 0 },
    facts: settledFacts(NO_FILES),
  }));
  useReportStartedWork(status, isAttached, loader, frame);
  return (isFullSize, awaitedCamera = null) => {
    if (!status || !isAttached.current) return;
    frame.revision = revision;
    frame.isFullSize = isFullSize;
    frame.awaitedCamera = awaitedCamera;
    pendingSceneWork(loader, frame.work);
    frame.facts = settledFacts(scene?.missingFiles() ?? NO_FILES);
    status.frameDrawn(frame);
  };
}

/** A load can start while no frame draws, so the status hears of it at once. Only a drawn frame settles. */
function useReportStartedWork(
  status: ViewStatus | null,
  isAttached: { readonly current: boolean },
  loader: ResourceLoader | null,
  frame: DrawnFrame
): void {
  useEffect(() => {
    if (!status) return undefined;
    const onWorkChange = () => {
      if (!isAttached.current) return;
      // The status reads the last frame in place, so the record changes only to report work.
      const work = pendingSceneWork(loader);
      if (!hasPendingWork(work)) return;
      frame.work = work;
      status.frameDrawn(frame);
    };
    const stops = [
      loader?.subscribePending(onWorkChange),
      textureWork.subscribe(onWorkChange),
      fontWork.subscribe(onWorkChange),
    ];
    return () => stops.forEach((stop) => stop?.());
  }, [status, isAttached, loader, frame]);
}
