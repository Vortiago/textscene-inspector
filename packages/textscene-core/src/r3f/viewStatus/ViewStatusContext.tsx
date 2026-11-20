import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { createViewStatusStore, type ViewStatusStore } from './viewStatus.js';

const ViewStatusContext = createContext<ViewStatusStore | null>(null);
ViewStatusContext.displayName = 'ViewStatusContext';

/** `store` where the caller holds the slot itself, as `mountScene` does. */
export function ViewStatusProvider({ store, children }: { store?: ViewStatusStore; children: ReactNode }) {
  const [own] = useState(() => (store ? null : createViewStatusStore()));
  return <ViewStatusContext.Provider value={store ?? own}>{children}</ViewStatusContext.Provider>;
}

/** A host's own store wins, so `mountScene` reads the store its canvas reports to. */
export function ViewStatusScope({ children }: { children: ReactNode }) {
  if (useViewStatusStore()) return children;
  return <ViewStatusProvider>{children}</ViewStatusProvider>;
}

/** Null with no provider, so a canvas mounted alone in a test still renders. */
export function useViewStatusStore(): ViewStatusStore | null {
  return useContext(ViewStatusContext);
}

/** `read` of the status, or false with no provider. */
function useStatusFlag(read: (status: ViewStatusStore) => boolean): boolean {
  const status = useViewStatusStore();
  return useSyncExternalStore(status?.subscribe ?? subscribeToNothing, () => (status ? read(status) : false));
}

/** An In-game capture reads the full window, so that view draws its target at full size until then. */
export function useIsCapturePending(): boolean {
  return useStatusFlag((status) => status.isCapturePending());
}
