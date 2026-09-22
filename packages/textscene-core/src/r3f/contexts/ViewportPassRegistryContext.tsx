/**
 * The ordered viewport pass driver: ONE `useFrame` (`<ViewportPassOrchestrator>`)
 * runs every registered offscreen viewport pass in dependency order each
 * frame, replacing the per-publisher `useFrame` each of `<SubViewport>`'s
 * offscreen pass and the native Control-subtree publisher used to own.
 *
 * Why one orchestrator rather than each publisher driving itself: R3F runs
 * default-priority `useFrame` subscribers in MOUNT order, which is parent
 * before child. A publisher nested inside another (a `ViewportTexture`
 * sampling a nested `SubViewport`) would therefore render one frame stale —
 * the outer pass ran before the inner one it samples had produced anything
 * this frame. Feeding every registered pass through `orderViewportPasses`
 * (dependencies first) and driving them from a single subscriber removes the
 * mount-order dependency entirely.
 *
 * `dependsOn` is supplied by whoever registers — the orchestrator itself
 * never inspects scene content. A cycle (two passes each depending on the
 * other, directly or transitively) has no valid render order: the affected
 * passes are simply never driven (their target keeps whatever it last held,
 * which is what makes the output deterministic frame over frame rather than
 * flickering), `logger.warn` names the offending sampler once per detected
 * cycle, and `useViewportPassCycle` lets a consumer (a viewport surface
 * sampling that specific path) fall back to its own placeholder instead of
 * showing a frozen or uninitialised texture.
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

/** Publish a pass at `path`; returns a cleanup that unregisters it. */
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

/** The cycle (if any) blocking the pass registered at `path`, or null when it renders normally. */
export function useViewportPassCycle(path: string | null): ViewportPassCycle | null {
  const { cycles } = useContext(StateContext);
  return path === null ? null : cycles.get(path) ?? null;
}

/** A stable, order-independent key for a cycle set — for deciding whether to re-warn. */
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
 * The single `useFrame` that drives every registered pass, dependencies
 * first. Must be mounted inside a `<Canvas>` — one instance per canvas that
 * can host offscreen passes (the 3D canvas, the 2D world canvas), both under
 * the SAME `<ViewportPassProvider>` so a pass registered from either drives
 * from whichever canvas is currently mounted.
 *
 * Default priority (unspecified): a priority-0 subscriber runs BEFORE R3F's
 * automatic main render, so every non-cyclic target this frame's main render
 * might sample was already filled. A non-default priority would also disable
 * that automatic render entirely — carried forward from the single-publisher
 * `useFrame` this orchestrator replaces.
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
