import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { createGameViewStatus, type GameViewSettled, type GameViewStatus } from './gameViewStatus.js';

const GameViewStatusContext = createContext<GameViewStatus | null>(null);
GameViewStatusContext.displayName = 'GameViewStatusContext';

/** `status` where the caller holds the slot itself, as `mountScene` does. */
export function GameViewStatusProvider({
  status,
  children,
}: {
  status?: GameViewStatus;
  children: ReactNode;
}) {
  const [own] = useState(() => (status ? null : createGameViewStatus()));
  return <GameViewStatusContext.Provider value={status ?? own}>{children}</GameViewStatusContext.Provider>;
}

/** Null with no provider, so a canvas mounted alone in a test still renders. */
export function useGameViewStatus(): GameViewStatus | null {
  return useContext(GameViewStatusContext);
}

/** `read` of the status, or `absent` with no provider. */
function useStatusValue<T>(read: (status: GameViewStatus) => T, absent: T): T {
  const status = useGameViewStatus();
  return useSyncExternalStore(status?.subscribe ?? subscribeToNothing, () =>
    status ? read(status) : absent
  );
}

/** The In-game view below the same `TscnSceneProvider`: null while pending, and with no such view. */
export function useGameViewSettled(): GameViewSettled | null {
  return useStatusValue((status) => status.settled(), null);
}

/** A capture reads the full window, so the view draws its target at full size until then. */
export function useHoldsFullWindow(): boolean {
  return useStatusValue((status) => status.isCapturePending(), false);
}

export function useGameViewPending(): boolean {
  return useStatusValue((status) => status.isPending(), false);
}
