import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createExternalStore } from '../../utils/externalStore.js';
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
  const [slot] = useState(() => createExternalStore<FreelookControl | null>(null));
  const value = useMemo<FreelookSlot>(
    () => ({
      register: (control) => {
        slot.set(control);
        return () => {
          if (slot.get() === control) slot.set(null);
        };
      },
      state: () => slot.get()?.getState() ?? null,
      subscribe: (listener) => {
        // The control in the slot changes with the canvas, so the state subscription follows it.
        let unsubscribeState = slot.get()?.subscribe(listener);
        const unsubscribeSlot = slot.subscribe(() => {
          unsubscribeState?.();
          unsubscribeState = slot.get()?.subscribe(listener);
          listener();
        });
        return () => {
          unsubscribeSlot();
          unsubscribeState?.();
        };
      },
    }),
    [slot]
  );
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
