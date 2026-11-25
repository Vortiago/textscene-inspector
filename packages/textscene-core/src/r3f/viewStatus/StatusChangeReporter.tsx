import { useEffect, useRef } from 'react';
import { useViewStatusStore } from './ViewStatusContext.js';
import { EMPTY_VIEW_STATUS, type ViewStatus } from './viewStatus.js';

/** Calls `onStatusChange` on each change, so a host hears a load that starts and ends in one task. */
export function StatusChangeReporter({ onStatusChange }: { onStatusChange: (status: ViewStatus) => void }) {
  const store = useViewStatusStore();
  const latest = useRef(onStatusChange);
  latest.current = onStatusChange;
  useEffect(() => {
    if (!store) return undefined;
    let heard = EMPTY_VIEW_STATUS;
    const check = () => {
      const now = store.status();
      if (!changesBeyondFrame(heard, now)) return;
      heard = now;
      tell(latest.current, now);
    };
    const stopListening = store.subscribe(check);
    check();
    return stopListening;
  }, [store]);
  return null;
}

// The store calls this inside a frame or an effect, so a host's throw surfaces in a microtask of its own.
function tell(onStatusChange: (status: ViewStatus) => void, status: ViewStatus): void {
  try {
    onStatusChange(status);
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}

// The frame numbers change twice a second, so a host polls `status()` for them.
function changesBeyondFrame(heard: ViewStatus, now: ViewStatus): boolean {
  return (
    heard.settled !== now.settled ||
    heard.pending.resources !== now.pending.resources ||
    heard.pending.textures !== now.pending.textures ||
    heard.pending.fonts !== now.pending.fonts ||
    heard.undrawn !== now.undrawn ||
    heard.isSoftwareRendering !== now.isSoftwareRendering ||
    heard.freelook !== now.freelook
  );
}
