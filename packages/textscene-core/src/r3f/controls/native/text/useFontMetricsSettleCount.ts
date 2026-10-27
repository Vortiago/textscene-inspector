/**
 * How many font metrics loads have settled, for a reader that built against metrics which were not
 * there yet and reads them again when the count moves.
 */

import { useSyncExternalStore } from 'react';
import { onSceneFontMetricsSettled, sceneFontSettleCount } from './sceneFontLoader';
import { subscribeToNothing } from '../../../../utils/subscribeToNothing';

/**
 * Watches the settled loads only while `isAwaitingMetrics`: a reader with no metrics to wait for
 * never re-renders when a font elsewhere settles. The count is the snapshot, so a load that settles
 * between a render and its subscription still re-renders the reader. The snapshot is the same in
 * both branches: one that switched with the branch left the reader a render behind when the wait ended.
 */
export function useFontMetricsSettleCount(isAwaitingMetrics: boolean): number {
  const subscribe = isAwaitingMetrics ? onSceneFontMetricsSettled : subscribeToNothing;
  return useSyncExternalStore(subscribe, sceneFontSettleCount, sceneFontSettleCount);
}
