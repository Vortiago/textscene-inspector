import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { ViewportPointerHandlers } from './useViewportSelection.js';

/** Binds the canvas half of the click picking to the view's canvas element, or nothing when null. */
export function useCanvasPickListeners(handlers: ViewportPointerHandlers | null): void {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!handlers) return;
    const { onCanvasPointerDown, onCanvasClick } = handlers;
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('click', onCanvasClick);
    return () => {
      canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [canvas, handlers]);
}
