/**
 * The frame profile's latest window as a small table: the frame totals, then each step's own time
 * and draw calls per frame, without the steps nested in it.
 */

import type { FrameStats } from './frameStats.js';
import styles from './PerformancePanel.module.css';

/** A GPU time whose result has not arrived yet. */
const PENDING = '–';

function formatMs(ms: number): string {
  return ms.toFixed(2);
}

/** A per-frame count, with one decimal only where the window's frames differ. */
function formatCount(perFrame: number): string {
  return String(Number(perFrame.toFixed(1)));
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
  return (
    <div className={styles.panel} data-testid="performance-overlay">
      {stats ? <WindowStats stats={stats} /> : 'Measuring…'}
    </div>
  );
}

function WindowStats({ stats }: { stats: FrameStats }) {
  return (
    <>
      <div className={styles.totals}>
        <strong data-testid="performance-fps">{Math.round(stats.fps)} FPS</strong>
        <span data-testid="performance-frame">{formatMs(stats.frameMs)} ms</span>
        <span data-testid="performance-cpu">CPU {formatMs(stats.cpuMs)} ms</span>
        <span data-testid="performance-gpu">{gpuTotalText(stats)}</span>
        <span data-testid="performance-draws">{formatCount(stats.drawCallsPerFrame)} draws</span>
      </div>
      <table className={styles.steps}>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">CPU ms</th>
            <th scope="col">GPU ms</th>
            <th scope="col" title="Draw calls per frame">
              Draws
            </th>
            <th scope="col" title="Runs per frame">
              ×
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.steps.map(({ step, cpuMs, gpuMs, drawCallsPerFrame, runsPerFrame }) => (
            <tr key={step}>
              <th scope="row">{step}</th>
              <td>{formatMs(cpuMs)}</td>
              <td>{formatGpuMs(gpuMs)}</td>
              <td>{formatCount(drawCallsPerFrame)}</td>
              <td>{formatCount(runsPerFrame)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
