import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { ResourceLoaderContext } from '../../../resources/ResourceLoaderContext.js';
import type { SceneValue } from '../../../scene/variant.js';
import { warnOfCameraFailure, type EditorViewAnswers } from '../../editorCamera/editorCameras.js';
import type { HeardStatusStore } from './previewViewStatus.js';
import { usePreviewCamera } from './previewCamera.js';

// The visual harness clicks for a `-selected` capture only after the last one.
const FIT_DELAYS_MS = [150, 500, 1100];

interface FrameOnOpenProps {
  view: EditorViewAnswers | null;
  heard: HeardStatusStore;
}

/** Opt-in: Godot opens each scene at a fixed orbit and frames only on F (node_3d_editor_plugin.h:420-426). */
export function FrameOnOpen({ view, heard }: FrameOnOpenProps) {
  const { mode, frameOnOpen } = useViewportMode();
  const hierarchy = useOptionalHierarchy();
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const hasScene = !!hierarchy?.sceneGraph;
  const loader = useContext(ResourceLoaderContext);
  // A return to the 3D mode finds the camera where it was left, as in Godot, so it frames no scene twice.
  const framedRoot = useRef<string | null>(null);
  // A ref, not a dependency: an ended preview starts no fit.
  const previewed = usePreviewCamera()?.camera ?? null;
  const isPreviewing = useRef(previewed !== null);
  useLayoutEffect(() => {
    isPreviewing.current = previewed !== null;
  }, [previewed]);

  const isFraming = frameOnOpen && hasScene && mode === '3D' && view !== null;
  useEffect(() => {
    if (!isFraming) return undefined;
    // The camera of the mode this effect ran in, as the getter follows a later switch.
    const camera = view.editorCamera;
    if (!camera) return undefined;
    // A settle-fit stands down once the camera has left this pose, so the user's own orbit, pan or zoom wins.
    let framedPose: SceneValue | null = null;
    let isCancelled = false;
    const fit = async () => {
      // A call waits for a stage, so a fit while none is bound would land on a later one.
      if (isCancelled || !camera.isInsideTree()) return;
      await camera.call('focus');
      // A focus through a previewed Camera3D frames nothing, so the next return to the 3D mode frames.
      if (!isPreviewing.current) framedRoot.current = rootKey;
      framedPose = await camera.get('transform');
    };
    const fitUnlessMoved = async () => {
      const pose = await camera.get('transform');
      if (framedPose === null || samePose(pose, framedPose)) await fit();
    };
    const isFramed = framedRoot.current === rootKey;
    if (isFramed) {
      camera
        .get('transform')
        .then((pose) => (framedPose ??= pose))
        .catch(warnOfCameraFailure);
    }
    const fitLogged = () => void fit().catch(warnOfCameraFailure);
    const timers = isFramed ? [] : FIT_DELAYS_MS.map((delay) => setTimeout(fitLogged, delay));

    // Each settle that ends a load fits, as one can precede an instanced `.glb` load. A write never does.
    let hasLoadedSinceSettle = (loader?.pendingResourceCount ?? 0) > 0;
    const stopWatchingLoads = loader?.subscribePending(() => {
      if (loader.pendingResourceCount > 0) hasLoadedSinceSettle = true;
    });
    let wasSettled = false;
    const fitOnSettle = () => {
      const isSettled = heard.get().status?.settled != null;
      if (isSettled && !wasSettled && hasLoadedSinceSettle) {
        hasLoadedSinceSettle = false;
        fitUnlessMoved().catch(warnOfCameraFailure);
      }
      wasSettled = isSettled;
    };
    const stopHearing = heard.subscribe(fitOnSettle);

    return () => {
      isCancelled = true;
      timers.forEach(clearTimeout);
      stopWatchingLoads?.();
      stopHearing();
    };
  }, [rootKey, isFraming, view, heard, loader]);

  return null;
}

function samePose(a: SceneValue | null, b: SceneValue): boolean {
  return typeof a === 'object' && a !== null && typeof b === 'object' && a.text === b.text;
}
