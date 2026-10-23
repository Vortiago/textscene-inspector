import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { FrameStatsProvider, useFrameStatsStore } from './FrameStatsContext';
import { PerformanceOverlay } from './PerformanceOverlay';
import type { FrameStats } from './frameStats';

const STATS: FrameStats = {
  fps: 50,
  frameMs: 20,
  cpuMs: 4,
  gpuMs: null,
  drawCallsPerFrame: 0,
  hasGpuTimer: false,
  rendersInSoftware: false,
  steps: [{ step: 'Other', cpuMs: 4, gpuMs: null, runsPerFrame: 1, drawCallsPerFrame: 0 }],
};

/** The overlay under a toggle set to `showPerformance`, and the store its profile publishes into. */
function renderOverlay(showPerformance: boolean) {
  let store: ReturnType<typeof useFrameStatsStore> | undefined;
  function StoreProbe() {
    store = useFrameStatsStore();
    return null;
  }
  render(
    <ViewportModeProvider initialShowPerformance={showPerformance}>
      <FrameStatsProvider>
        <StoreProbe />
        <PerformanceOverlay />
      </FrameStatsProvider>
    </ViewportModeProvider>
  );
  return store!;
}

describe('PerformanceOverlay', () => {
  it("shows the profile's latest window while the toggle is on", () => {
    const store = renderOverlay(true);
    act(() => store.set(STATS));
    expect(screen.getByTestId('performance-fps').textContent).toBe('50 FPS');
  });

  it('shows that it is measuring before the first window arrives', () => {
    renderOverlay(true);
    expect(screen.getByTestId('performance-overlay').textContent).toBe('Measuring…');
  });

  it('shows nothing while the toggle is off, whatever the store holds (edge case)', () => {
    const store = renderOverlay(false);
    act(() => store.set(STATS));
    expect(screen.queryByTestId('performance-overlay')).toBeNull();
  });
});
