import { useEffect, useMemo } from 'react';
import { PENDING_CAPTURE, previewCaptureStateOf, type PreviewCaptureState } from './previewCaptureState.js';
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';
import type { ViewSettle } from './viewSettle.js';

interface CaptureStateReporterProps {
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
  view: ViewAnswers | null;
  settle: ViewSettle;
  hasScene: boolean;
  viewportError: Error | null;
}

export function CaptureStateReporter({
  onCaptureStateChange,
  view,
  settle,
  hasScene,
  viewportError,
}: CaptureStateReporterProps) {
  const state = useMemo(
    () => previewCaptureStateOf({ view, settle, hasScene, viewportError }),
    [view, settle, hasScene, viewportError]
  );

  useEffect(() => {
    onCaptureStateChange?.(state);
  }, [onCaptureStateChange, state]);

  useEffect(() => {
    if (!onCaptureStateChange) return undefined;
    return () => onCaptureStateChange(PENDING_CAPTURE);
  }, [onCaptureStateChange]);

  return null;
}
