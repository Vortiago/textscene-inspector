/**
 * A pending load for content that arrives outside the resource bus, such as a lazy chunk or a web
 * font, so a reader that waits for the loader to settle waits for it too.
 */

import { useEffect } from 'react';
import { usePendingLoads } from './ResourceLoaderContext';

/** Counts the caller as one pending load of its view while `isPending` holds. */
export function usePendingWhile(isPending: boolean): void {
  const pending = usePendingLoads();
  useEffect(() => {
    if (!pending || !isPending) return undefined;
    return pending.begin();
  }, [pending, isPending]);
}
