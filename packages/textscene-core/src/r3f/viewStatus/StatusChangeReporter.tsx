import { useEffect, useRef } from 'react';
import { useViewStatusStore } from './ViewStatusContext.js';
import type { ViewStatus } from './viewStatus.js';

/** The status a host has heard before the first call: nothing settled, pending, undrawn or found. */
const UNREPORTED: ViewStatus = {
  settled: null,
  pending: { textures: 0, fonts: 0 },
  frame: null,
  undrawn: [],
  isSoftwareRendering: false,
};

/** Calls `onStatusChange` on each change, so a host hears a load that starts and ends in one task. */
export function StatusChangeReporter({ onStatusChange }: { onStatusChange: (status: ViewStatus) => void }) {
  const store = useViewStatusStore();
  const latest = useRef(onStatusChange);
  latest.current = onStatusChange;
  useEffect(() => {
    if (!store) return undefined;
    let heard = UNREPORTED;
    const check = () => {
      const now = store.status();
      if (!changesBeyondFrame(heard, now)) return;
      heard = now;
      latest.current(now);
    };
    const stopListening = store.subscribe(check);
    check();
    return stopListening;
  }, [store]);
  return null;
}

// The frame numbers change twice a second, so a host polls `status()` for them.
function changesBeyondFrame(heard: ViewStatus, now: ViewStatus): boolean {
  return (
    heard.settled !== now.settled ||
    heard.pending.textures !== now.pending.textures ||
    heard.pending.fonts !== now.pending.fonts ||
    heard.undrawn !== now.undrawn ||
    heard.isSoftwareRendering !== now.isSoftwareRendering
  );
}
