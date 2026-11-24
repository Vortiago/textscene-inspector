import { createContext, useContext } from 'react';
import type { CanvasView } from '../../TscnCanvas.js';

const PreviewViewContext = createContext<CanvasView | null>(null);
PreviewViewContext.displayName = 'PreviewViewContext';

/** The shell's mounted view, or null while none is. */
export const PreviewViewProvider = PreviewViewContext.Provider;

export function usePreviewView(): CanvasView | null {
  return useContext(PreviewViewContext);
}
