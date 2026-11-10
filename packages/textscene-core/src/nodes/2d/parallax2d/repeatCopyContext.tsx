/**
 * Which repeat copy a node renders in. A canvas item under a repeat source draws once per copy,
 * unless a nearer repeat source replaces it (`renderer_canvas_cull.cpp:368-380`), so the nearer
 * one draws only in the outer source's unrepeated copy.
 */

import { createContext, useContext } from 'react';

/** False inside a copy shifted away from the repeat source's own position. Written by `Parallax2D`. */
const RepeatBaseCopyContext = createContext(true);
RepeatBaseCopyContext.displayName = 'RepeatBaseCopyContext';

export const RepeatBaseCopyProvider = RepeatBaseCopyContext.Provider;

export function useIsRepeatBaseCopy(): boolean {
  return useContext(RepeatBaseCopyContext);
}
