import { useEffect, useLayoutEffect, useState } from 'react';
import { addAfterEffect, addEffect, useThree } from '@react-three/fiber';
import { useViewShow } from '../viewShow/ViewShowContext.js';
import { countSceneRender, startFrameCount, type FrameProfile } from './frameProfile.js';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import { timeSceneDraws } from './sceneDrawStep.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';

/** Mounted once in each top-level `<Canvas>`. Only `show.performance` times the steps: a GPU query each. */
export function FrameProfiler(): null {
  const isTimed = useViewShow().performance;
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const get = useThree((state) => state.get);
  const store = useViewStatusStore();
  // Godot's monitor counts the 3D scene render only, so a 2D view counts no object.
  const countsSurfaces = useCanvasWorkspace() === '3d';
  const [profile, setProfile] = useState<FrameProfile | null>(null);

  useEffect(() => {
    if (!store) return undefined;
    const profile = startFrameCount(gl, store.frameMeasured);
    setProfile(profile);
    // Global effects bracket every root's subscribers and renders in R3F's loop.
    const stopBeginning = addEffect((timestamp) => profile.beginFrame(timestamp));
    const stopEnding = addAfterEffect(() => profile.endFrame());
    const stopDrawing = timeSceneDraws(gl, scene, () => get().camera, countsSurfaces);
    return () => {
      stopDrawing();
      stopBeginning();
      stopEnding();
      profile.stop();
      setProfile(null);
      store.frameMeasured(null);
    };
  }, [gl, scene, get, store, countsSurfaces]);

  // The count keeps running, so a switch of `show.performance` leaves `status().frame` in place.
  useEffect(() => {
    if (!profile || !isTimed) return undefined;
    profile.startTimings();
    return () => profile.stopTimings();
  }, [profile, isTimed]);

  return null;
}

/** Counts each commit of the caller, the root of a scene tree, as a scene render. */
export function useSceneRenderCount(): void {
  const gl = useThree((state) => state.gl);
  // No dependencies: the effect runs on every commit, which is what it counts.
  useLayoutEffect(() => countSceneRender(gl));
}
