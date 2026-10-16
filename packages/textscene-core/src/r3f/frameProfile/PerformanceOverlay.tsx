/** The performance overlay over the viewport, shown while the Display menu's Performance toggle is on. */

import { useViewportMode } from '../contexts/ViewportModeContext.js';
import { useFrameStats } from './FrameStatsContext.js';
import { PerformancePanel } from './PerformancePanel.js';

export function PerformanceOverlay() {
  const { showPerformance } = useViewportMode();
  const stats = useFrameStats();
  return showPerformance ? <PerformancePanel stats={stats} /> : null;
}
