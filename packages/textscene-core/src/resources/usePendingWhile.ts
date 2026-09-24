/**
 * A pending load for content that arrives outside the resource bus, such as a lazy chunk or a web
 * font, so a reader that waits for the loader to settle waits for it too.
 */

import { useEffect } from 'react';
import { useResourceLoader } from './useResource';

/** Counts the caller as one pending load while `pending` holds. */
export function usePendingWhile(pending: boolean): void {
  const loader = useResourceLoader();
  useEffect(() => {
    if (!loader || !pending) return undefined;
    return loader.beginPending();
  }, [loader, pending]);
}
