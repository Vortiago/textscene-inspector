/**
 * Stands in for the drawn canvas item a test mounts its subject below: what that item hands down,
 * as an item drawn outside the shared live tree publishes it.
 */
import type { ReactNode } from 'react';
import { CHAIN_START, type InheritedCanvasItemState } from '../canvasItemPass/canvasItemPass';
import { CanvasParentProvider } from '../canvasItemPass/inheritedCanvasState';

/** What a chain start hands down with `overrides` laid over it. */
export function inheritedState(overrides: Partial<InheritedCanvasItemState> = {}): InheritedCanvasItemState {
  return { ...CHAIN_START, ...overrides };
}

/** `children` below a drawn item that hands down `state`. */
export function InheritedFrom({
  state,
  children,
}: {
  state: InheritedCanvasItemState;
  children?: ReactNode;
}) {
  return <CanvasParentProvider value={{ state }}>{children}</CanvasParentProvider>;
}
