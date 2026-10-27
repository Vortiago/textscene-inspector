/** The count of a `WorkCount` as React state. */
import { useSyncExternalStore } from 'react';
import type { WorkCount } from './workCount';

export function usePendingWork(work: WorkCount): number {
  return useSyncExternalStore(work.subscribe, work.pending, work.pending);
}
