import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { ViewportPointerHandlers } from './useViewportSelection.js';

/** Binds the canvas half of the click picking to the view's canvas element, or nothing when null. */
export function useCanvasPickListeners(handlers: ViewportPointerHandlers | null): void {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => (handlers ? bindCanvasPickListeners(canvas, handlers) : undefined), [canvas, handlers]);
}

/** Adds the listeners to `canvas` and to its window. The caller owns the returned remover. */
export function bindCanvasPickListeners(
  canvas: HTMLCanvasElement,
  handlers: ViewportPointerHandlers
): () => void {
  const { onCanvasPointerDown, onCanvasClick, onWindowPointerEnd, onWindowPointerMove } = handlers;
  const view = canvas.ownerDocument.defaultView;
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('click', onCanvasClick);
  view?.addEventListener('pointerup', onWindowPointerEnd);
  view?.addEventListener('pointercancel', onWindowPointerEnd);
  view?.addEventListener('pointermove', onWindowPointerMove);
  return () => {
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    canvas.removeEventListener('click', onCanvasClick);
    view?.removeEventListener('pointerup', onWindowPointerEnd);
    view?.removeEventListener('pointercancel', onWindowPointerEnd);
    view?.removeEventListener('pointermove', onWindowPointerMove);
  };
}
