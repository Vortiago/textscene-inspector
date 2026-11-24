import { createContext, useContext, useState } from 'react';
import { createExternalStore, type ExternalStore } from '../../../utils/externalStore.js';
import { useExternalStoreSelection } from '../../hooks/createExternalStore.js';
import { undrawnNodeAt, type UndrawnNode } from '../../viewStatus/undrawnNodes.js';
import type { ViewFreelook, ViewStatus } from '../../viewStatus/viewStatus.js';

/** The status the shell's view last reported, and how many times it has turned pending. */
export interface HeardStatus {
  /** Null before the view's first report, and once the view has crashed. */
  status: ViewStatus | null;
  /** A load can start and end between two renders, so a reader counts the rounds, not the flips it saw. */
  round: number;
}

/** A store, so each change renders only the parts of the shell that read it, never the canvas. */
export interface HeardStatusStore extends ExternalStore<HeardStatus> {
  /** The view's `onStatusChange`. */
  onStatusChange(status: ViewStatus): void;
  /** Drops the status of a view that reports no more, such as one that crashed. */
  forget(): void;
}

function createHeardStatusStore(): HeardStatusStore {
  const store = createExternalStore<HeardStatus>({ status: null, round: 0 });
  return {
    ...store,
    onStatusChange: (status) => {
      const { status: last, round } = store.get();
      store.set({ status, round: last?.settled && !status.settled ? round + 1 : round });
    },
    forget: () => store.set({ status: null, round: store.get().round }),
  };
}

/** One store for the shell's lifetime. */
export function useHeardStatus(): HeardStatusStore {
  return useState(createHeardStatusStore)[0];
}

/** Whether the view is pending, and its round: what a settle wait reads. */
export function useHeardSettle(store: HeardStatusStore): { isPending: boolean; round: number } {
  const isPending = useExternalStoreSelection(store, (heard) => !heard.status?.settled);
  const round = useExternalStoreSelection(store, (heard) => heard.round);
  return { isPending, round };
}

/** The part of the heard status that `select` picks, read from a context's store. */
export function useHeardSelection<S>(
  store: ExternalStore<HeardStatus>,
  select: (status: ViewStatus | null) => S
): S {
  return useExternalStoreSelection(store, (heard) => select(heard.status));
}

const NO_VIEW: ExternalStore<HeardStatus> = createExternalStore<HeardStatus>({ status: null, round: 0 });

const PreviewViewStatusContext = createContext<ExternalStore<HeardStatus>>(NO_VIEW);
PreviewViewStatusContext.displayName = 'PreviewViewStatusContext';

export const PreviewViewStatusProvider = PreviewViewStatusContext.Provider;

/** What the shell's view holds of the node at the live path `livePath` and does not draw, or null. */
export function useUndrawnNode(livePath: string): UndrawnNode | null {
  const store = useContext(PreviewViewStatusContext);
  return useHeardSelection(store, (status) => (status ? undrawnNodeAt(status.undrawn, livePath) : null));
}

/** The 3D canvas's freelook, as the shell's view last reported it, or null with none. */
export function useHeardFreelook(): ViewFreelook | null {
  const store = useContext(PreviewViewStatusContext);
  return useHeardSelection(store, (status) => status?.freelook ?? null);
}
