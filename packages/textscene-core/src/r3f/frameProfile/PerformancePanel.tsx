/**
 * The frame profile's latest window as a small table: the frame totals, then each step's own time
 * per frame, without the steps nested in it.
 */

import type { FrameStats } from './frameStats.js';
import styles from './PerformancePanel.module.css';

/** A GPU time whose result has not arrived yet. */
const PENDING = '–';

function formatMs(ms: number): string {
  return ms.toFixed(2);
}

function formatGpuMs(ms: number | null): string {
  return ms === null ? PENDING : formatMs(ms);
}

function gpuTotalText({ hasGpuTimer, gpuMs }: FrameStats): string {
  if (!hasGpuTimer) return 'GPU n/a';
  return gpuMs === null ? `GPU ${PENDING}` : `GPU ${formatMs(gpuMs)} ms`;
}

/** Null `stats` is a profile that has not published its first window. */
export function PerformancePanel({ stats }: { stats: FrameStats | null }) {
  if (!stats) {
    return (
      <div className={styles.panel} data-testid="performance-overlay">
        Measuring…
      </div>
    );
  }
  return (
    <div className={styles.panel} data-testid="performance-overlay">
      <div className={styles.totals}>
        <strong data-testid="performance-fps">{Math.round(stats.fps)} FPS</strong>
        <span data-testid="performance-frame">{formatMs(stats.frameMs)} ms</span>
        <span data-testid="performance-cpu">CPU {formatMs(stats.cpuMs)} ms</span>
        <span data-testid="performance-gpu">{gpuTotalText(stats)}</span>
      </div>
      <table className={styles.steps}>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">CPU ms</th>
            <th scope="col">GPU ms</th>
            <th scope="col" title="Runs per frame">
              ×
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.steps.map(({ step, cpuMs, gpuMs, callsPerFrame }) => (
            <tr key={step}>
              <th scope="row">{step}</th>
              <td>{formatMs(cpuMs)}</td>
              <td>{formatGpuMs(gpuMs)}</td>
              <td>{Number(callsPerFrame.toFixed(1))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
