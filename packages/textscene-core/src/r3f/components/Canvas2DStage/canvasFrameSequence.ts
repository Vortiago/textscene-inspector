/**
 * The steps one 2D canvas runs for one frame, in Godot's order: sample the shadow inputs, accumulate
 * the lights, write the instance records of the translated items, then draw the items. The root canvas and a SubViewport's canvas both run this sequence.
 */

import { createContext, useContext, useLayoutEffect } from 'react';

/** The steps one canvas runs for one frame. Each canvas holds one, and its steps register in it. */
export interface CanvasFrameSteps {
  /** The shadow casters and the light poses of this canvas (`renderer_viewport.cpp:556`, `:642`). */
  readonly shadowSamplers: Set<() => void>;
  /** The pass steps and the light accumulation of this canvas, or null with no light pass. */
  lightPass: (() => void) | null;
  /**
   * What a translated item writes into its instance records before the draw: three uploads a
   * geometry before the first draw hook runs (r187 `WebGLRenderer.js:1912`).
   */
  readonly recordWriters: Set<() => void>;
}

export function createCanvasFrameSteps(): CanvasFrameSteps {
  return { shadowSamplers: new Set(), lightPass: null, recordWriters: new Set() };
}

/**
 * Runs the shadow samplers, the light pass and the record writers, then `drawItems` (`renderer_viewport.cpp:688`),
 * which fills the group buffers and copies the frame out. Godot runs every `_process` and animation
 * of a frame before it draws, so each step sees the poses of the frame it lights.
 */
export function runCanvasFrame(steps: CanvasFrameSteps, drawItems: () => void): void {
  for (const sample of steps.shadowSamplers) sample();
  steps.lightPass?.();
  for (const write of steps.recordWriters) write();
  drawItems();
}

/**
 * The steps of the canvas around a component, or null outside every canvas. A sampler or a light
 * pass outside a canvas runs nowhere: no canvas draws what it would prepare.
 */
export const CanvasFrameStepsContext = createContext<CanvasFrameSteps | null>(null);

/** Runs `sample` as a shadow sampler of the enclosing canvas. */
export function useShadowSampler(sample: () => void): void {
  const steps = useContext(CanvasFrameStepsContext);
  useLayoutEffect(() => {
    if (!steps) return;
    steps.shadowSamplers.add(sample);
    return () => {
      steps.shadowSamplers.delete(sample);
    };
  }, [steps, sample]);
}

/** Runs `write` as a record writer of the enclosing canvas. */
export function useRecordWriter(write: (() => void) | null): void {
  const steps = useContext(CanvasFrameStepsContext);
  useLayoutEffect(() => {
    if (!steps || !write) return;
    steps.recordWriters.add(write);
    return () => {
      steps.recordWriters.delete(write);
    };
  }, [steps, write]);
}

/** Runs `lightPass` as the light pass of the enclosing canvas. */
export function useCanvasLightPass(lightPass: () => void): void {
  const steps = useContext(CanvasFrameStepsContext);
  useLayoutEffect(() => {
    if (!steps) return;
    steps.lightPass = lightPass;
    return () => {
      if (steps.lightPass === lightPass) steps.lightPass = null;
    };
  }, [steps, lightPass]);
}
