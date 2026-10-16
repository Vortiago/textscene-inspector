import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PerformancePanel } from './PerformancePanel';
import type { FrameStats } from './frameStats';

const STATS: FrameStats = {
  fps: 59.94,
  frameMs: 16.683,
  cpuMs: 3.456,
  gpuMs: 8.125,
  hasGpuTimer: true,
  steps: [
    { step: 'Shadows', cpuMs: 0.5, gpuMs: 4.25, callsPerFrame: 2 },
    { step: 'Fog', cpuMs: 0.25, gpuMs: 3, callsPerFrame: 1 },
    { step: 'Other', cpuMs: 2.706, gpuMs: 0.875, callsPerFrame: 1 },
  ],
};

/** The text of each cell of the step table's row for `step`. */
function rowCells(step: string): string[] {
  const row = screen.getByRole('row', { name: new RegExp(`^${step}`) });
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

describe('PerformancePanel', () => {
  it('shows the frame rate, the frame interval and the CPU and GPU time per frame', () => {
    render(<PerformancePanel stats={STATS} />);
    expect(screen.getByTestId('performance-fps').textContent).toBe('60 FPS');
    expect(screen.getByTestId('performance-frame').textContent).toBe('16.68 ms');
    expect(screen.getByTestId('performance-cpu').textContent).toBe('CPU 3.46 ms');
    expect(screen.getByTestId('performance-gpu').textContent).toBe('GPU 8.13 ms');
  });

  it("lists each step's own CPU and GPU time and its runs per frame", () => {
    render(<PerformancePanel stats={STATS} />);
    expect(rowCells('Shadows')).toEqual(['0.50', '4.25', '2']);
    expect(rowCells('Other')).toEqual(['2.71', '0.88', '1']);
  });

  it('says the GPU time is unavailable when the context has no timer query', () => {
    render(<PerformancePanel stats={{ ...STATS, gpuMs: null, hasGpuTimer: false }} />);
    expect(screen.getByTestId('performance-gpu').textContent).toBe('GPU n/a');
  });

  it('shows a dash for a GPU time whose result has not arrived', () => {
    const steps = STATS.steps.map((s) => ({ ...s, gpuMs: null }));
    render(<PerformancePanel stats={{ ...STATS, gpuMs: null, steps }} />);
    expect(screen.getByTestId('performance-gpu').textContent).toBe('GPU –');
    expect(rowCells('Fog')).toEqual(['0.25', '–', '1']);
  });

  it('says it is measuring before the first window publishes (edge case)', () => {
    render(<PerformancePanel stats={null} />);
    expect(screen.getByTestId('performance-overlay').textContent).toBe('Measuring…');
  });
});
