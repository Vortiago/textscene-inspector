import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { FreelookControl, FreelookState } from './freelook.js';

interface FreelookSlot {
  /** The 3D canvas registers its freelook here, and gets the cleanup. */
  register: (control: FreelookControl) => () => void;
  /** The 3D canvas's freelook state, or null with no 3D canvas. Stable until the state changes. */
  state: () => FreelookState | null;
  /** Calls `listener` on each new freelook state, and when a canvas registers or leaves. */
  subscribe: (listener: () => void) => () => void;
}

const FreelookContext = createContext<FreelookSlot | null>(null);
FreelookContext.displayName = 'FreelookContext';

/** Hands the 3D canvas's freelook to the speed readout. A newer canvas may take the slot first. */
export function FreelookProvider({ children }: { children: ReactNode }) {
  const slot = useRef<FreelookControl | null>(null);
  const listeners = useRef(new Set<() => void>());
  const notify = useCallback(() => {
    for (const listener of listeners.current) listener();
  }, []);
  const register = useCallback(
    (control: FreelookControl) => {
      slot.current = control;
      notify();
      return () => {
        if (slot.current !== control) return;
        slot.current = null;
        notify();
      };
    },
    [notify]
  );
  const state = useCallback(() => slot.current?.getState() ?? null, []);
  const subscribe = useCallback((listener: () => void) => {
    // The control in the slot changes with the canvas, so the state subscription follows it.
    let unsubscribeState = slot.current?.subscribe(listener);
    const onSlotChange = () => {
      unsubscribeState?.();
      unsubscribeState = slot.current?.subscribe(listener);
      listener();
    };
    listeners.current.add(onSlotChange);
    return () => {
      listeners.current.delete(onSlotChange);
      unsubscribeState?.();
    };
  }, []);
  const value = useMemo(() => ({ register, state, subscribe }), [register, state, subscribe]);
  return <FreelookContext.Provider value={value}>{children}</FreelookContext.Provider>;
}

/** The slot's registration, or null with no provider. */
export function useRegisterFreelook(): FreelookSlot['register'] | null {
  return useContext(FreelookContext)?.register ?? null;
}

/** The 3D canvas's freelook state, live, or null with no provider or no 3D canvas. */
export function useFreelookState(): FreelookState | null {
  const slot = useContext(FreelookContext);
  const state = slot?.state ?? noFreelookState;
  return useSyncExternalStore(slot?.subscribe ?? subscribeToNothing, state, state);
}

const subscribeToNothing = (): (() => void) => () => {};
const noFreelookState = (): null => null;
