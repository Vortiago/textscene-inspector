import { useMemo } from 'react';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { useDrawingBufferSize } from '../useDrawingBufferSize.js';
import { fittedTargetSize, rootWindow, shrinkRootWindow, type RootWindow } from './rootWindow.js';
import { paneScale } from './windowFit.js';
import { useIsCapturePending } from './GameViewStatusContext.js';

/** The root window as the project opens it. */
export function useProjectRootWindow(): RootWindow {
  const { settings } = useProjectSettings();
  return useMemo(() => rootWindow(settings), [settings]);
}

/** A smaller pane renders the target at the fitted size. A capture holds the full size until it reads. */
export function useDrawnRootWindow(projectWindow: RootWindow): RootWindow {
  const pane = useDrawingBufferSize();
  const isCapturePending = useIsCapturePending();
  const scale = isCapturePending ? 1 : paneScale({ x: pane.width, y: pane.height }, projectWindow.size);
  const { x, y } = fittedTargetSize(projectWindow, scale);
  return useMemo(() => shrinkRootWindow(projectWindow, { x, y }), [projectWindow, x, y]);
}
