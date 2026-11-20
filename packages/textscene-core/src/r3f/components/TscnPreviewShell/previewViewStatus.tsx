import { createContext, useCallback, useContext, useState } from 'react';
import { undrawnNodeAt, type UndrawnNode } from '../../viewStatus/undrawnNodes.js';
import type { ViewStatus } from '../../viewStatus/viewStatus.js';

/** The status the shell's view last reported, and how many times it has turned pending. */
export interface HeardStatus {
  /** Null before the view's first report. */
  status: ViewStatus | null;
  /** A load can start and end between two renders, so a reader counts the rounds, not the flips it saw. */
  round: number;
}

/** The view's `onStatusChange`, and what it last heard. */
export function useHeardStatus(): HeardStatus & { onStatusChange: (status: ViewStatus) => void } {
  const [heard, setHeard] = useState<HeardStatus>({ status: null, round: 0 });
  const onStatusChange = useCallback(
    (status: ViewStatus) =>
      setHeard(({ status: last, round }) => ({
        status,
        round: last?.settled && !status.settled ? round + 1 : round,
      })),
    []
  );
  return { ...heard, onStatusChange };
}

const PreviewViewStatusContext = createContext<ViewStatus | null>(null);
PreviewViewStatusContext.displayName = 'PreviewViewStatusContext';

export const PreviewViewStatusProvider = PreviewViewStatusContext.Provider;

/** What the shell's view holds of the node at the live path `livePath` and does not draw, or null. */
export function useUndrawnNode(livePath: string): UndrawnNode | null {
  const status = useContext(PreviewViewStatusContext);
  return status ? undrawnNodeAt(status.undrawn, livePath) : null;
}
