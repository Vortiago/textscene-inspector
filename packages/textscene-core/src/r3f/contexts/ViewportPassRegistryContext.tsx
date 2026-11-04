/**
 * One `useFrame` runs every offscreen viewport pass, dependencies first. R3F
 * runs default-priority subscribers in mount order, parent first, so a pass that
 * samples a nested `SubViewport` would render one frame stale. The registrant
 * supplies `dependsOn`: the orchestrator never inspects scene content. A pass with a `gate` renders
 * by its update mode, as Godot's `draw_viewports` decides (`renderer_viewport.cpp:769-813`).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import * as logger from '../../logger.js';
import { orderViewportPasses, type ViewportPassCycle } from '../../nodes/viewport/passOrder.js';
import {
  GateClock,
  renderingPassIds,
  type GatedPass,
  type TargetRenderState,
} from '../../nodes/viewport/renderGate.js';
import type { UpdateGate } from '../../nodes/viewport/subviewport/viewportGate.js';
import { useOptionalHierarchy } from './HierarchyContext.js';
import { useSceneAssetsSettled } from '../useSceneAssetsSettled.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';
import { updateTextureAtlases, useTextureAtlasFrame } from '../textureAtlas/updateTextureAtlases.js';
import {
  createExternalStore,
  useExternalStoreSelection,
  useExternalStoreValue,
  type ExternalStore,
} from '../hooks/createExternalStore.js';

export interface ViewportPass {
  /** ids (dispatcher-absolute node paths) of the OTHER passes this pass's content samples. */
  dependsOn: readonly string[];
  /** Perform this frame's offscreen render. Never called while this pass sits in a cycle. */
  render: () => void;
  /** What decides whether the pass renders. A pass without one renders every frame. */
  gate?: PassGate;
}

/** What the orchestrator reads of a SubViewport to decide whether its pass renders. */
export interface PassGate extends UpdateGate {
  /** The renders of the pass's target. The pass's `render` takes each one. */
  state: TargetRenderState;
  /** Whether a consumer samples the target now. */
  isSampled(): boolean;
  /** Starts the target over, as a new parse of the scene makes a new one. */
  restart(gl: THREE.WebGLRenderer): void;
}

/** Publishes a pass at `path` and returns the cleanup. */
type RegisterViewportPass = (path: string, pass: ViewportPass) => () => void;

interface PassRegistryState {
  passes: ReadonlyMap<string, ViewportPass>;
  order: readonly string[];
  cycles: ReadonlyMap<string, ViewportPassCycle>;
}

const EMPTY_STATE: PassRegistryState = registryState(new Map());

/** Without a provider, a registration sets nothing and no pass is ever driven. */
const NO_PROVIDER: ExternalStore<PassRegistryState> = {
  get: () => EMPTY_STATE,
  set: () => {},
  subscribe: () => () => {},
};

/**
 * Written only by `registerPass`, through a provider's own store. A store, not a context value,
 * since every Texture2D slot reads its cycles and a registration re-renders only the readers of
 * a cycle it changes.
 */
const StateContext = createContext<ExternalStore<PassRegistryState>>(NO_PROVIDER);
StateContext.displayName = 'ViewportPassStateContext';

/** Stable publisher, for a `<SubViewport>`-style offscreen pass. */
export function useRegisterViewportPass(): RegisterViewportPass {
  const state = useContext(StateContext);
  return useCallback<RegisterViewportPass>((path, pass) => registerPass(state, path, pass), [state]);
}

/** Sets `pass` at `path` in `state`, with the order and cycles it leads to, and returns the cleanup. */
function registerPass(state: ExternalStore<PassRegistryState>, path: string, pass: ViewportPass): () => void {
  if (state === NO_PROVIDER) return () => {};
  setPasses(state, new Map(state.get().passes).set(path, pass));
  return () => {
    // Only this exact pass, so a remount that re-registered first survives.
    if (state.get().passes.get(path) !== pass) return;
    const next = new Map(state.get().passes);
    next.delete(path);
    setPasses(state, next);
  };
}

function setPasses(state: ExternalStore<PassRegistryState>, passes: ReadonlyMap<string, ViewportPass>): void {
  state.set(registryState(passes, state.get().cycles));
}

/** The state for `passes`. A cycle equal to one in `previous` stays that object, so its readers keep it. */
function registryState(
  passes: ReadonlyMap<string, ViewportPass>,
  previous: ReadonlyMap<string, ViewportPassCycle> = new Map()
): PassRegistryState {
  const result = orderViewportPasses([...passes].map(([id, pass]) => ({ id, dependsOn: pass.dependsOn })));
  const cycles = new Map<string, ViewportPassCycle>();
  for (const cycle of result.cycles) {
    const kept = previous.get(cycle.sampler);
    cycles.set(cycle.sampler, kept && isSameCycle(kept, cycle) ? kept : cycle);
  }
  const isUnchanged = cycles.size === previous.size && [...cycles].every(([id, c]) => previous.get(id) === c);
  return { passes, order: result.order, cycles: isUnchanged ? previous : cycles };
}

function isSameCycle(a: ViewportPassCycle, b: ViewportPassCycle): boolean {
  return a.path.length === b.path.length && a.path.every((id, i) => id === b.path[i]);
}

/**
 * The cycle that blocks the pass at `path`, or null. A pass in a cycle is never
 * driven and its target keeps its last frame, so a surface that samples it
 * shows its own placeholder instead. A reader of no path never re-renders.
 */
export function useViewportPassCycle(path: string | null): ViewportPassCycle | null {
  return useExternalStoreSelection(useContext(StateContext), ({ cycles }) =>
    path === null ? null : (cycles.get(path) ?? null)
  );
}

/** An order-independent key for a cycle set, so each set warns once. */
function cycleSetKey(cycles: readonly ViewportPassCycle[]): string {
  return cycles
    .map((c) => c.sampler)
    .sort()
    .join('|');
}

export function ViewportPassProvider({ children }: { children: ReactNode }) {
  const [state] = useState(() => createExternalStore(EMPTY_STATE));
  useCycleWarnings(state);
  return <StateContext.Provider value={state}>{children}</StateContext.Provider>;
}

/** Warns once for each set of cycles the registry holds. */
function useCycleWarnings(state: ExternalStore<PassRegistryState>): void {
  const cycles = useExternalStoreSelection(state, (registry) => registry.cycles);
  const lastWarnedKey = useRef<string>('');
  useEffect(() => {
    const cycleList = [...cycles.values()];
    const key = cycleSetKey(cycleList);
    if (key === lastWarnedKey.current) return;
    lastWarnedKey.current = key;
    for (const cycle of cycleList) {
      logger.warn(
        `[Viewport] pass cycle detected at ${cycle.sampler} — never rendered: ${cycle.path.join(' -> ')}`
      );
    }
  }, [cycles]);
}

/**
 * Mounted in each `<Canvas>` that hosts offscreen passes, under one provider,
 * so a pass drives from whichever canvas is mounted. Default priority runs
 * before R3F's automatic main render, which fills every target first. Another
 * priority would turn that render off. The texture atlases rebuild once a frame,
 * before the passes, as Godot's do (`updateTextureAtlases`), with or without a pass.
 */
export function ViewportPassOrchestrator(): null {
  const { passes, order, cycles } = useExternalStoreValue(useContext(StateContext));
  useTextureAtlasFrame();
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const { isSettled: isLoaded } = useSceneAssetsSettled();
  const clock = useRef(new GateClock()).current;
  // The scene graph the clock counts for. A new parse makes new viewports, which restart the count.
  const clockGraph = useRef(sceneGraph);

  useFrame(({ gl }) => {
    updateTextureAtlases(gl);
    // The first frame of a new scene counts as unloaded: its assets have not registered as pending yet.
    const isRestarting = clockGraph.current !== sceneGraph;
    if (isRestarting) {
      clockGraph.current = sceneGraph;
      restartGate(clock, passes, gl);
    }
    const frame = clock.begin(isLoaded && !isRestarting);
    if (order.length > 0) {
      beginStep(gl, 'SubViewports');
      const gated = gatedPassesOf(passes);
      const rendering = gated.length > 0 ? renderingPassIds(gated, frame) : null;
      for (const id of order) {
        const pass = passes.get(id);
        if (!pass || cycles.has(id)) continue;
        if (pass.gate && !rendering?.has(id)) continue;
        pass.render();
        clock.spend(id);
      }
      endStep(gl, 'SubViewports');
    }
    markSampled(clock, passes);
  });

  return null;
}

function restartGate(
  clock: GateClock,
  passes: ReadonlyMap<string, ViewportPass>,
  gl: THREE.WebGLRenderer
): void {
  clock.restart();
  for (const { gate } of passes.values()) gate?.restart(gl);
}

function gatedPassesOf(passes: ReadonlyMap<string, ViewportPass>): GatedPass[] {
  const gated: GatedPass[] = [];
  for (const [id, { gate }] of passes) {
    if (gate) {
      gated.push({
        id,
        updateMode: gate.updateMode,
        enclosingId: gate.enclosingPath,
        hasRendered: gate.state.hasRendered,
      });
    }
  }
  return gated;
}

function markSampled(clock: GateClock, passes: ReadonlyMap<string, ViewportPass>): void {
  for (const [id, { gate }] of passes) if (gate?.isSampled()) clock.mark(id);
  clock.prune((id) => passes.has(id));
}
