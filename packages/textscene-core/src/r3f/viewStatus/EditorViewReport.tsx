import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { drawCanvasFrame } from '../drawCanvasFrame.js';
import { readCanvasPixels } from './canvasImage.js';
import { useViewReport } from './useViewReport.js';
import { useViewStatus } from './ViewStatusContext.js';

/** Priority 0, so R3F keeps its own render, which follows the report in the same frame. */
export function EditorViewReport() {
  const report = useViewReport();
  useFrame(() => report(true));
  useCanvasCapture();
  return null;
}

/** A capture draws its own frame, so it answers while the loop is stopped too. */
function useCanvasCapture(): void {
  const status = useViewStatus();
  const getState = useThree((state) => state.get);
  useEffect(() => {
    if (!status) return undefined;
    let isMounted = true;
    const captureIfDue = () => {
      if (!isMounted || !status.isCaptureDue()) return;
      status.capture(() => {
        const state = getState();
        drawCanvasFrame(state);
        return readCanvasPixels(state.gl);
      });
    };
    // A microtask, so a capture that a frame's report makes due draws after that frame, not inside it.
    const stopListening = status.subscribe(() => queueMicrotask(captureIfDue));
    return () => {
      isMounted = false;
      stopListening();
    };
  }, [status, getState]);
}
