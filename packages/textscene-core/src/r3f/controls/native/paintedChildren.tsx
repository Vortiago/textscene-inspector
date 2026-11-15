/**
 * Where a Control's children draw relative to its painter. A type whose registration declares
 * `wrapsChildren` opens a scope for its subtree, so its children are the painter's React children.
 * Every other painter draws first, and its children follow as siblings.
 */
import type { ReactNode } from 'react';
import { ClipMaskProvider } from '../../canvasGroup/ClipMaskContext';
import { controlComponentRegistry } from '../ControlComponentRegistry';

export interface PaintedChildren {
  /** The painter's `children` prop: the children of a wrapping type, its internal Controls included, else `undefined`. */
  inPainter: ReactNode | undefined;
  /** What follows the painter: the children of every other type. */
  afterPainter: ReactNode | undefined;
  /** The internal Controls of a type that does not wrap, drawn beside its painter. */
  besidePainter: ReactNode | undefined;
}

/**
 * The children and the internal Controls of a Control of `typeName`, placed by its registration. A
 * wrapping painter clips its subtree (`set_clip_contents`), and Godot clips the internal children with
 * the authored ones, so they draw inside it too.
 */
export function placeChildren(typeName: string, children: ReactNode, internals?: ReactNode): PaintedChildren {
  if (!controlComponentRegistry.wrapsChildren(typeName))
    return { inPainter: undefined, afterPainter: children, besidePainter: internals };
  // The wrapping painter publishes its own clip, so its children start outside any clip mask.
  return {
    inPainter: (
      <ClipMaskProvider value={null}>
        {children}
        {internals}
      </ClipMaskProvider>
    ),
    afterPainter: undefined,
    besidePainter: undefined,
  };
}
