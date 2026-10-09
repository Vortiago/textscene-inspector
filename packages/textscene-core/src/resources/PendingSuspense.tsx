/**
 * A Suspense boundary whose suspended children count as one pending load, so a reader that waits
 * for the loader to settle, such as a capture, waits for a lazy chunk too. Its fallback draws
 * nothing: the R3F reconciler's tree has no host for a `<div>`.
 */

import { Suspense, type ReactNode } from 'react';
import { usePendingWhile } from './usePendingWhile';

function PendingFallback(): null {
  usePendingWhile(true);
  return null;
}

export function PendingSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PendingFallback />}>{children}</Suspense>;
}
