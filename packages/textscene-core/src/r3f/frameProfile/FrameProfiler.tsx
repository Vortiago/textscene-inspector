/**
 * Runs a frame profile on its canvas's renderer while the Performance toggle is on, and publishes
 * each window to the overlay. While the toggle is off it mounts nothing, so no frame is timed.
 */

import { useEffect } from 'react';
import { addAfterEffect, addEffect, useFrame, useThree } from '@react-three/fiber';
import { useViewportMode } from '../contexts/ViewportModeContext.js';
import { beginStep, endStep, startFrameProfile } from './frameProfile.js';
import { useFrameStatsStore } from './FrameStatsContext.js';
import { timeSceneDraws } from './sceneDrawStep.js';
import type { RenderStep } from './frameStats.js';

/** Mounted once in each top-level `<Canvas>`. */
export function FrameProfiler() {
  return useViewportMode().showPerformance ? <RunningFrameProfile /> : null;
}

function RunningFrameProfile(): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const get = useThree((state) => state.get);
  const store = useFrameStatsStore();

  useEffect(() => {
    const profile = startFrameProfile(gl, store.set);
    // Global effects bracket every root's subscribers and renders in R3F's loop.
    const stopBeginning = addEffect((timestamp) => profile.beginFrame(timestamp));
    const stopEnding = addAfterEffect(() => profile.endFrame());
    const stopDrawing = timeSceneDraws(gl, scene, () => get().camera);
    return () => {
      stopDrawing();
      stopBeginning();
      stopEnding();
      profile.stop();
      store.set(null);
    };
  }, [gl, scene, get, store]);

  return null;
}

/**
 * Times the `useFrame` subscribers at `priority` as `step`. R3F runs subscribers in priority order,
 * so a marker half a priority either side brackets every subscriber at `priority`. Mount it only
 * beside a subscriber with a positive priority: a positive marker turns off R3F's own render.
 */
export function SubscriberStep({ step, priority }: { step: RenderStep; priority: number }) {
  return useViewportMode().showPerformance ? <SubscriberStepMarkers step={step} priority={priority} /> : null;
}

function SubscriberStepMarkers({ step, priority }: { step: RenderStep; priority: number }): null {
  useFrame(({ gl }) => beginStep(gl, step), priority - 0.5);
  useFrame(({ gl }) => endStep(gl, step), priority + 0.5);
  return null;
}
