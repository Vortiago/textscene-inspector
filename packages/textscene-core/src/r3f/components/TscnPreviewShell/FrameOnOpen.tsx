import { useEffect, useLayoutEffect, useRef } from 'react';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import type { SceneValue } from '../../../scene/variant.js';
import { warnOfCameraFailure, type EditorViewAnswers } from '../../editorView/editorCamera/editorCameras.js';
import type { HeardStatusStore } from './previewViewStatus.js';
import { usePreviewCamera } from './previewCamera.js';

// The visual harness clicks for a `-selected` capture only after the last one.
const FIT_DELAYS_MS = [150, 500, 1100];

interface FrameOnOpenProps {
  rootScenePath: string;
  hasScene: boolean;
  view: EditorViewAnswers | null;
  heard: HeardStatusStore;
}

/** Opt-in: Godot opens each scene at a fixed orbit and frames only on F (node_3d_editor_plugin.h:420-426). */
export function FrameOnOpen({ rootScenePath, hasScene, view, heard }: FrameOnOpenProps) {
  const { mode, frameOnOpen } = useViewportMode();
  // A return to the 3D mode finds the camera where it was left, as in Godot, so it frames no scene twice.
  const framedRoot = useRef<string | null>(null);
  // The pose the last fit of `framedRoot` left, so a later run stands down once the user has moved.
  const framedRootPose = useRef<SceneValue | null>(null);
  // The heard status outlives a scene, so a new root's view may have loaded before it first settles.
  const settleFitRoot = useRef<string | null>(null);
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
      const pose = await camera.get('transform');
      if (isCancelled) return;
      framedPose = pose;
      // A focus through a previewed Camera3D frames nothing, so the next return to the 3D mode frames.
      if (isPreviewing.current) return;
      framedRoot.current = rootScenePath;
      framedRootPose.current = pose;
    };
    const fitUnlessMoved = async () => {
      const pose = await camera.get('transform');
      if (framedPose === null || samePose(pose, framedPose)) await fit();
    };
    const isFramed = framedRoot.current === rootScenePath;
    if (isFramed) framedPose = framedRootPose.current;
    const fitLogged = () => void fit().catch(warnOfCameraFailure);
    // The delays count from the stage's bind, which a hidden or slow canvas makes after the view mounts.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const startTimers = () => {
      if (!isCancelled) timers.push(...FIT_DELAYS_MS.map((delay) => setTimeout(fitLogged, delay)));
    };
    if (!isFramed) {
      if (camera.isInsideTree()) startTimers();
      else camera.get('transform').then(startTimers, warnOfCameraFailure);
    }

    // Each settle that ends a load fits, as one can precede an instanced `.glb` load. A write never does.
    const isLoading = () => {
      const status = heard.get().status;
      // A view that has not reported may have loaded already, unless it shows a scene framed before.
      return status === null ? !isFramed : status.pending.resources > 0;
    };
    let hasLoadedSinceSettle = settleFitRoot.current !== rootScenePath || isLoading();
    let wasSettled = false;
    const fitOnSettle = () => {
      if (isLoading()) hasLoadedSinceSettle = true;
      const isSettled = heard.get().status?.settled != null;
      if (isSettled && !wasSettled && hasLoadedSinceSettle) {
        hasLoadedSinceSettle = false;
        settleFitRoot.current = rootScenePath;
        fitUnlessMoved().catch(warnOfCameraFailure);
      }
      wasSettled = isSettled;
    };
    const stopHearing = heard.subscribe(fitOnSettle);

    return () => {
      isCancelled = true;
      timers.forEach(clearTimeout);
      stopHearing();
    };
  }, [rootScenePath, isFraming, view, heard]);

  return null;
}

function samePose(a: SceneValue | null, b: SceneValue): boolean {
  return typeof a === 'object' && a !== null && typeof b === 'object' && a.text === b.text;
}
