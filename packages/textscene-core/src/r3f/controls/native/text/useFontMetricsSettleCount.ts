/**
 * How many font loads have settled, metrics and outlines both, for a reader that built against a
 * font that was not there yet and reads it again when the count moves.
 */

import { useSyncExternalStore } from 'react';
import { onSceneFontMetricsSettled, sceneFontSettleCount } from './sceneFontLoader';
import { subscribeToNothing } from '../../../../utils/subscribeToNothing';

/**
 * Watches the settled loads only while `isAwaitingFont`: a reader with no font to wait for
 * never re-renders when a font elsewhere settles. The count is the snapshot, so a load that settles
 * between a render and its subscription still re-renders the reader. The snapshot is the same in
 * both branches: one that switched with the branch left the reader a render behind when the wait ended.
 */
export function useFontMetricsSettleCount(isAwaitingFont: boolean): number {
  const subscribe = isAwaitingFont ? onSceneFontMetricsSettled : subscribeToNothing;
  return useSyncExternalStore(subscribe, sceneFontSettleCount, sceneFontSettleCount);
}
