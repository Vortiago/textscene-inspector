import type { FrameStats, FrameTimings } from './frameStats.js';
import { PERFORMANCE_TESTIDS } from './performanceTestIds.js';
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

function gpuTotalText({ hasGpuTimer, gpuMs }: FrameTimings): string {
  if (!hasGpuTimer) return 'GPU n/a';
  return gpuMs === null ? `GPU ${PENDING}` : `GPU ${formatMs(gpuMs)} ms`;
}

/** Null `stats` is a profile that has not published its first window. */
export function PerformancePanel({ stats }: { stats: FrameStats | null }) {
  return (
    <div className={styles.panel} data-testid={PERFORMANCE_TESTIDS.overlay}>
      {stats ? <WindowStats stats={stats} /> : 'Measuring…'}
    </div>
  );
}

function WindowStats({ stats }: { stats: FrameStats }) {
  return (
    <>
      <div className={styles.totals}>
        <strong data-testid="performance-fps">{Math.round(stats.fps)} FPS</strong>
        <span data-testid={PERFORMANCE_TESTIDS.frameMs}>{formatMs(stats.frameMs)} ms</span>
        <span data-testid="performance-cpu">CPU {formatMs(stats.cpuMs)} ms</span>
        {stats.timings && <span data-testid="performance-gpu">{gpuTotalText(stats.timings)}</span>}
        {stats.timings && (
          <span data-testid={PERFORMANCE_TESTIDS.sceneRenders}>
            {formatCount(stats.timings.sceneRendersPerFrame)} scene renders
          </span>
        )}
        <span data-testid={PERFORMANCE_TESTIDS.drawCalls}>{formatCount(stats.drawCallsPerFrame)} draws</span>
        <span data-testid="performance-objects">{formatCount(stats.objectsPerFrame)} objects</span>
        <span data-testid="performance-primitives">{formatCount(stats.primitivesPerFrame)} primitives</span>
      </div>
      {stats.timings && <StepTable steps={stats.timings.steps} />}
    </>
  );
}

function StepTable({ steps }: { steps: FrameTimings['steps'] }) {
  return (
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
        {steps.map(({ step, cpuMs, gpuMs, drawCallsPerFrame, runsPerFrame }) => (
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
  );
}
