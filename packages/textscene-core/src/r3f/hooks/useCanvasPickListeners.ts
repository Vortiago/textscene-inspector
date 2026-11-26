import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { ViewportPointerHandlers } from './useViewportSelection.js';

/** Binds the canvas half of the click picking to the view's canvas element, or nothing when null. */
export function useCanvasPickListeners(handlers: ViewportPointerHandlers | null): void {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!handlers) return;
    const { onCanvasPointerDown, onCanvasClick, onWindowPointerEnd } = handlers;
    const view = canvas.ownerDocument.defaultView;
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('click', onCanvasClick);
    view?.addEventListener('pointerup', onWindowPointerEnd);
    view?.addEventListener('pointercancel', onWindowPointerEnd);
    return () => {
      canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      canvas.removeEventListener('click', onCanvasClick);
      view?.removeEventListener('pointerup', onWindowPointerEnd);
      view?.removeEventListener('pointercancel', onWindowPointerEnd);
    };
  }, [canvas, handlers]);
}
