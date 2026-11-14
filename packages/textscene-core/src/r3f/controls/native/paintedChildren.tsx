/**
 * Where a Control's children draw relative to its painter. A type whose registration declares
 * `wrapsChildren` opens a scope for its subtree, so its children are the painter's React children.
 * Every other painter draws first, and its children follow as siblings.
 */
import type { ReactNode } from 'react';
import { ClipMaskProvider } from '../../canvasGroup/ClipMaskContext';
import { controlComponentRegistry } from '../ControlComponentRegistry';

export interface PaintedChildren {
  /** The painter's `children` prop: the children of a wrapping type, else `undefined`. */
  inPainter: ReactNode | undefined;
  /** What follows the painter: the children of every other type. */
  afterPainter: ReactNode | undefined;
}

/** The children of a Control of `typeName`, placed by its registration. */
export function placeChildren(typeName: string, children: ReactNode): PaintedChildren {
  if (!controlComponentRegistry.wrapsChildren(typeName))
    return { inPainter: undefined, afterPainter: children };
  // The wrapping painter publishes its own clip, so its children start outside any clip mask.
  return { inPainter: <ClipMaskProvider value={null}>{children}</ClipMaskProvider>, afterPainter: undefined };
}
