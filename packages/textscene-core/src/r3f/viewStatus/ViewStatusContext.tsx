import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { createViewStatus, type ViewStatus } from './viewStatus.js';

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

/** `read` of the status, or false with no provider. */
function useStatusFlag(read: (status: ViewStatus) => boolean): boolean {
  const status = useViewStatus();
  return useSyncExternalStore(status?.subscribe ?? subscribeToNothing, () => (status ? read(status) : false));
}

/** An In-game capture reads the full window, so that view draws its target at full size until then. */
export function useIsCapturePending(): boolean {
  return useStatusFlag((status) => status.isCapturePending());
}

export function useViewPending(): boolean {
  return useStatusFlag((status) => status.isPending());
}
