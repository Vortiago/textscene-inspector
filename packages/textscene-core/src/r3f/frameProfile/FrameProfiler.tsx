import { useEffect } from 'react';
import { addAfterEffect, addEffect, useFrame, useThree } from '@react-three/fiber';
import { useViewShow } from '../viewShow/ViewShowContext.js';
import { beginStep, endStep, startFrameCount, startFrameProfile } from './frameProfile.js';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import { timeSceneDraws } from './sceneDrawStep.js';
import type { RenderStep } from './frameStats.js';

/** Mounted once in each top-level `<Canvas>`. Only `show.performance` times the steps: a GPU query each. */
export function FrameProfiler(): null {
  const isTimed = useViewShow().performance;
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const get = useThree((state) => state.get);
  const store = useViewStatusStore();

  useEffect(() => {
    if (!store) return undefined;
    const profile = (isTimed ? startFrameProfile : startFrameCount)(gl, store.frameMeasured);
    // Global effects bracket every root's subscribers and renders in R3F's loop.
    const stopBeginning = addEffect((timestamp) => profile.beginFrame(timestamp));
    const stopEnding = addAfterEffect(() => profile.endFrame());
    const stopDrawing = timeSceneDraws(gl, scene, () => get().camera);
    return () => {
      stopDrawing();
      stopBeginning();
      stopEnding();
      profile.stop();
      store.frameMeasured(null);
    };
  }, [gl, scene, get, store, isTimed]);

  return null;
}

/**
 * Times the `useFrame` subscribers at `priority` as `step`. R3F runs subscribers in priority order,
 * so a marker half a priority either side brackets every subscriber at `priority`. Mount it only
 * beside a subscriber with a positive priority: a positive marker turns off R3F's own render.
 */
export function SubscriberStep({ step, priority }: { step: RenderStep; priority: number }) {
  return useViewShow().performance ? <SubscriberStepMarkers step={step} priority={priority} /> : null;
}

function SubscriberStepMarkers({ step, priority }: { step: RenderStep; priority: number }): null {
  useFrame(({ gl }) => beginStep(gl, step), priority - 0.5);
  useFrame(({ gl }) => endStep(gl, step), priority + 0.5);
  return null;
}
