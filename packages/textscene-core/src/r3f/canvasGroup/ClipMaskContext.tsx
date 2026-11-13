/** The mask of the `clip_children` owner whose own pixels a lit canvas item is drawing. */

import { createContext, useContext } from 'react';
import type { ClipMask } from './clipMask';

const ClipMaskContext = createContext<ClipMask | null>(null);
ClipMaskContext.displayName = 'ClipMaskContext';

export const ClipMaskProvider = ClipMaskContext.Provider;

/** Null outside the own pixels of an owner, such as in a descendant, which the owner does not mask. */
export function useClipMask(): ClipMask | null {
  return useContext(ClipMaskContext);
}
