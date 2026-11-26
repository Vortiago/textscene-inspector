/**
 * A pending load for content that arrives outside the resource bus, such as a lazy chunk or a web
 * font, so a reader that waits for the loader to settle waits for it too.
 */

import { useEffect } from 'react';
import { useViewWork } from './ResourceLoaderContext';
import type { ViewWork } from './viewWork';

/** Counts the caller as one piece of its view's `kind` of work while `isPending` holds. */
export function usePendingWhile(isPending: boolean, kind: keyof ViewWork = 'resources'): void {
  const pending = useViewWork()?.[kind];
  useEffect(() => {
    if (!pending || !isPending) return undefined;
    return pending.begin();
  }, [pending, isPending]);
}
