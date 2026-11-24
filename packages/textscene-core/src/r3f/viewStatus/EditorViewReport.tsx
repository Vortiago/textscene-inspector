import { useEffect, useRef } from 'react';
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { drawCanvasFrame } from '../drawCanvasFrame.js';
import { readCanvasPixels } from './canvasImage.js';
import { useViewReport } from './useViewReport.js';
import { useViewStatusStore } from './ViewStatusContext.js';
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
  const store = useViewStatusStore();
  const getState = useThree((state) => state.get);
  useEffect(
    () =>
      store?.readWith(() => {
        const state = getState();
        drawCanvasFrame(state);
        return readCanvasPixels(state.gl);
      }),
    [store, getState]
  );
}
