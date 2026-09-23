/**
 * One `useFrame` runs every offscreen viewport pass, dependencies first. R3F
 * runs default-priority subscribers in mount order, parent first, so a pass that
 * samples a nested `SubViewport` would render one frame stale. The registrant
 * supplies `dependsOn`: the orchestrator never inspects scene content.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFrame } from '@react-three/fiber';
import * as logger from '../../logger.js';
import { orderViewportPasses, type ViewportPassCycle } from '../../nodes/viewport/passOrder.js';

export interface ViewportPass {
  /** ids (dispatcher-absolute node paths) of the OTHER passes this pass's content samples. */
  dependsOn: readonly string[];
  /** Perform this frame's offscreen render. Never called while this pass sits in a cycle. */
  render: () => void;
}

/** Publishes a pass at `path` and returns the cleanup. */
export type RegisterViewportPass = (path: string, pass: ViewportPass) => () => void;

interface PassRegistryState {
  passes: ReadonlyMap<string, ViewportPass>;
  order: readonly string[];
  cycles: ReadonlyMap<string, ViewportPassCycle>;
}

const EMPTY_PASSES: ReadonlyMap<string, ViewportPass> = new Map();
const EMPTY_CYCLES: ReadonlyMap<string, ViewportPassCycle> = new Map();
const EMPTY_STATE: PassRegistryState = { passes: EMPTY_PASSES, order: [], cycles: EMPTY_CYCLES };

const NO_OP_REGISTER: RegisterViewportPass = () => () => {};

const RegisterContext = createContext<RegisterViewportPass>(NO_OP_REGISTER);
RegisterContext.displayName = 'RegisterViewportPassContext';

const StateContext = createContext<PassRegistryState>(EMPTY_STATE);
StateContext.displayName = 'ViewportPassStateContext';

/** Stable publisher, for a `<SubViewport>`-style offscreen pass. */
export function useRegisterViewportPass(): RegisterViewportPass {
  return useContext(RegisterContext);
}

/**
 * The cycle that blocks the pass at `path`, or null. A pass in a cycle is never
 * driven and its target keeps its last frame, so a surface that samples it
 * shows its own placeholder instead.
 */
export function useViewportPassCycle(path: string | null): ViewportPassCycle | null {
  const { cycles } = useContext(StateContext);
  return path === null ? null : cycles.get(path) ?? null;
}

/** An order-independent key for a cycle set, so each set warns once. */
function cycleSetKey(cycles: readonly ViewportPassCycle[]): string {
  return cycles
    .map((c) => c.sampler)
    .sort()
    .join('|');
}

export function ViewportPassProvider({ children }: { children: ReactNode }) {
  const [passes, setPasses] = useState<ReadonlyMap<string, ViewportPass>>(() => new Map());

  const register = useCallback<RegisterViewportPass>((path, pass) => {
    setPasses((prev) => {
      const next = new Map(prev);
      next.set(path, pass);
      return next;
    });
    return () => {
      setPasses((prev) => {
        if (prev.get(path) !== pass) return prev;
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
    };
  }, []);

  const { order, cycles } = useMemo(() => {
    const result = orderViewportPasses(
      [...passes].map(([id, pass]) => ({ id, dependsOn: pass.dependsOn }))
    );
    const cycleMap = new Map<string, ViewportPassCycle>();
    for (const cycle of result.cycles) cycleMap.set(cycle.sampler, cycle);
    return { order: result.order, cycles: cycleMap };
  }, [passes]);

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

  const state = useMemo<PassRegistryState>(() => ({ passes, order, cycles }), [passes, order, cycles]);

  return (
    <RegisterContext.Provider value={register}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </RegisterContext.Provider>
  );
}

/**
 * Mounted in each `<Canvas>` that hosts offscreen passes, under one provider,
 * so a pass drives from whichever canvas is mounted. Default priority runs
 * before R3F's automatic main render, which fills every target first. Another
 * priority would turn that render off.
 */
export function ViewportPassOrchestrator(): null {
  const { passes, order, cycles } = useContext(StateContext);

  useFrame(() => {
    for (const id of order) {
      if (cycles.has(id)) continue;
      passes.get(id)?.render();
    }
  });

  return null;
}
