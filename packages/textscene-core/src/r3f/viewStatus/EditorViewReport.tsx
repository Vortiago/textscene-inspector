import { useEffect, useRef } from 'react';
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { drawCanvasFrame } from '../drawCanvasFrame.js';
import { readCanvasPixels } from './canvasImage.js';
import { useViewReport } from './useViewReport.js';
import { useViewStatus } from './ViewStatusContext.js';
import { useAwaitedCamera } from '../viewCamera.js';

export function EditorViewReport() {
  useReportAfterRender();
  useCanvasCapture();
  return null;
}

/** An after effect, so a frame is reported once its render, R3F's own or a pass that owns it, has drawn. */
function useReportAfterRender(): void {
  const report = useViewReport();
  const awaitedCamera = useAwaitedCamera();
  const latestReport = useRef(() => report(true, awaitedCamera()));
  latestReport.current = () => report(true, awaitedCamera());
  const hasDrawn = useRef(false);
  useFrame(() => {
    hasDrawn.current = true;
  });
  useEffect(
    () =>
      addAfterEffect(() => {
        if (!hasDrawn.current) return;
        hasDrawn.current = false;
        latestReport.current();
      }),
    []
  );
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
    const stopListening = status.subscribe(() => {
      if (status.isCapturePending()) queueMicrotask(captureIfDue);
    });
    return () => {
      isMounted = false;
      stopListening();
    };
  }, [status, getState]);
}
