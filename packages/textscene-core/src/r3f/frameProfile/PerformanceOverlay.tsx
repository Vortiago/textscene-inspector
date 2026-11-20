import { useViewShow } from '../viewShow/ViewShowContext.js';
import { useFrameStats } from './FrameStatsContext.js';
import { PerformancePanel } from './PerformancePanel.js';

export function PerformanceOverlay() {
  const { performance } = useViewShow();
  const stats = useFrameStats();
  return performance ? <PerformancePanel stats={stats} /> : null;
}
