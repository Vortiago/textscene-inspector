import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { createViewStatus, type ViewSettled, type ViewStatus } from './viewStatus.js';

const ViewStatusContext = createContext<ViewStatus | null>(null);
ViewStatusContext.displayName = 'ViewStatusContext';

/** `status` where the caller holds the slot itself, as `mountScene` does. */
export function ViewStatusProvider({ status, children }: { status?: ViewStatus; children: ReactNode }) {
  const [own] = useState(() => (status ? null : createViewStatus()));
  return <ViewStatusContext.Provider value={status ?? own}>{children}</ViewStatusContext.Provider>;
}

/** Null with no provider, so a canvas mounted alone in a test still renders. */
export function useViewStatus(): ViewStatus | null {
  return useContext(ViewStatusContext);
}

/** `read` of the status, or `absent` with no provider. */
function useStatusValue<T>(read: (status: ViewStatus) => T, absent: T): T {
  const status = useViewStatus();
  return useSyncExternalStore(status?.subscribe ?? subscribeToNothing, () =>
    status ? read(status) : absent
  );
}

/** The view below the same `TscnSceneProvider`, in any mode: null while pending, and with no view. */
export function useGameViewSettled(): ViewSettled | null {
  return useStatusValue((status) => status.settled(), null);
}

/** A capture reads the full window, so the view draws its target at full size until then. */
export function useIsCapturePending(): boolean {
  return useStatusValue((status) => status.isCapturePending(), false);
}

export function useViewPending(): boolean {
  return useStatusValue((status) => status.isPending(), false);
}
