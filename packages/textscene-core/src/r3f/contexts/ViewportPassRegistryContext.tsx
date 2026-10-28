/**
 * One `useFrame` runs every offscreen viewport pass, dependencies first. R3F
 * runs default-priority subscribers in mount order, parent first, so a pass that
 * samples a nested `SubViewport` would render one frame stale. The registrant
 * supplies `dependsOn`: the orchestrator never inspects scene content.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as logger from '../../logger.js';
import { orderViewportPasses, type ViewportPassCycle } from '../../nodes/viewport/passOrder.js';
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
  state.set(registryState(new Map(state.get().passes).set(path, pass)));
  return () => {
    // Only this exact pass, so a remount that re-registered first survives.
    if (state.get().passes.get(path) !== pass) return;
    const next = new Map(state.get().passes);
    next.delete(path);
    state.set(registryState(next));
  };
}

function registryState(passes: ReadonlyMap<string, ViewportPass>): PassRegistryState {
  const result = orderViewportPasses([...passes].map(([id, pass]) => ({ id, dependsOn: pass.dependsOn })));
  const cycles = new Map<string, ViewportPassCycle>();
  for (const cycle of result.cycles) cycles.set(cycle.sampler, cycle);
  return { passes, order: result.order, cycles };
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

  useFrame(({ gl }) => {
    updateTextureAtlases(gl);
    if (order.length === 0) return;
    beginStep(gl, 'SubViewports');
    for (const id of order) {
      if (cycles.has(id)) continue;
      passes.get(id)?.render();
    }
    endStep(gl, 'SubViewports');
  });

  return null;
}
