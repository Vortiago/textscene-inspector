/**
 * The steps one 2D canvas runs for one frame, in Godot's order: sample the shadow inputs, accumulate
 * the lights, then draw the items. The root canvas and a SubViewport's canvas both run this sequence.
 */

import { createContext, useContext, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';

/** The steps one canvas runs for one frame. Each canvas holds one, and its steps register in it. */
export interface CanvasFrameSteps {
  /** The shadow casters and the light poses of this canvas (`renderer_viewport.cpp:556`, `:642`). */
  readonly shadowSamplers: Set<() => void>;
  /** The pass steps and the light accumulation of this canvas, or null with no light pass. */
  lightPass: (() => void) | null;
}

export function createCanvasFrameSteps(): CanvasFrameSteps {
  return { shadowSamplers: new Set(), lightPass: null };
}

/**
 * Runs the shadow samplers, then the light pass, then `drawItems` (`renderer_viewport.cpp:688`),
 * which fills the group buffers and copies the frame out. Godot runs every `_process` and animation
 * of a frame before it draws, so each step sees the poses of the frame it lights.
 */
export function runCanvasFrame(steps: CanvasFrameSteps, drawItems: () => void): void {
  for (const sample of steps.shadowSamplers) sample();
  steps.lightPass?.();
  drawItems();
}

/** The steps of the canvas around a component, or null outside every canvas. */
export const CanvasFrameStepsContext = createContext<CanvasFrameSteps | null>(null);

/**
 * Runs `sample` as a shadow sampler of the enclosing canvas. Outside a canvas it samples on every
 * frame by itself, so a component mounted alone still samples.
 */
export function useShadowSampler(sample: () => void): void {
  const steps = useContext(CanvasFrameStepsContext);
  useLayoutEffect(() => {
    if (!steps) return;
    steps.shadowSamplers.add(sample);
    return () => {
      steps.shadowSamplers.delete(sample);
    };
  }, [steps, sample]);
  useFrame(() => {
    if (!steps) sample();
  });
}

/**
 * Runs `lightPass` as the light pass of the enclosing canvas. Outside a canvas it runs on every frame
 * by itself.
 */
export function useCanvasLightPass(lightPass: () => void): void {
  const steps = useContext(CanvasFrameStepsContext);
  useLayoutEffect(() => {
    if (!steps) return;
    steps.lightPass = lightPass;
    return () => {
      if (steps.lightPass === lightPass) steps.lightPass = null;
    };
  }, [steps, lightPass]);
  useFrame(() => {
    if (!steps) lightPass();
  });
}
