import { createContext, createElement, useContext, useLayoutEffect, type ReactNode } from 'react';

/** The steps one canvas runs for one frame. Each canvas holds one, and its steps register in it. */
export interface CanvasFrameSteps {
  /** The shadow casters and the light poses of this canvas (`renderer_viewport.cpp:556`, `:642`). */
  readonly shadowSamplers: Set<() => void>;
  /** The pass steps and the light accumulation of this canvas, or null with no light pass. */
  lightPass: (() => void) | null;
  /** Translated items' record writes: three uploads geometry before a draw hook (`WebGLRenderer.js:1912`). */
  readonly recordWriters: Set<() => void>;
}

export function createCanvasFrameSteps(): CanvasFrameSteps {
  return { shadowSamplers: new Set(), lightPass: null, recordWriters: new Set() };
}

/** Runs the shadow samplers, the light pass, the record writers, then draws (`renderer_viewport.cpp:688`). */
export function runCanvasFrame(steps: CanvasFrameSteps, drawItems: () => void): void {
  for (const sample of steps.shadowSamplers) sample();
  steps.lightPass?.();
  for (const write of steps.recordWriters) write();
  drawItems();
}

/** The steps of the canvas around a component, or null outside one, where no canvas runs a step. */
export const CanvasFrameStepsContext = createContext<CanvasFrameSteps | null>(null);

// Apart from the steps: a lighting boundary hides the light steps, and the drawing canvas writes the records.
const CanvasRecordWritersContext = createContext<Set<() => void> | null>(null);

/** Provides `steps` as the frame steps of the canvas inside, its record writers among them. */
export function CanvasFrameStepsProvider({
  steps,
  children,
}: {
  steps: CanvasFrameSteps;
  children: ReactNode;
}) {
  const writers = createElement(
    CanvasRecordWritersContext.Provider,
    { value: steps.recordWriters },
    children
  );
  return createElement(CanvasFrameStepsContext.Provider, { value: steps }, writers);
}

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
  const writers = useContext(CanvasRecordWritersContext);
  useLayoutEffect(() => {
    if (!writers || !write) return;
    writers.add(write);
    return () => {
      writers.delete(write);
    };
  }, [writers, write]);
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
