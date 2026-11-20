import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ViewShowProvider } from '../viewShow/ViewShowContext';
import { ViewStatusProvider } from '../viewStatus/ViewStatusContext';
import { createViewStatusStore } from '../viewStatus/viewStatus';
import { PerformanceOverlay } from './PerformanceOverlay';
import type { FrameStats } from './frameStats';

const STATS: FrameStats = {
  fps: 50,
  frameMs: 20,
  cpuMs: 4,
  drawCallsPerFrame: 0,
  objectsPerFrame: 0,
  primitivesPerFrame: 0,
};

/** The overlay under a toggle set to `showPerformance`, and the store its profile publishes into. */
function renderOverlay(showPerformance: boolean) {
  const store = createViewStatusStore();
  render(
    <ViewShowProvider show={{ performance: showPerformance }}>
      <ViewStatusProvider store={store}>
        <PerformanceOverlay />
      </ViewStatusProvider>
    </ViewShowProvider>
  );
  return store;
}

describe('PerformanceOverlay', () => {
  it("shows the profile's latest window while the toggle is on", () => {
    const store = renderOverlay(true);
    act(() => store.frameMeasured(STATS));
    expect(screen.getByTestId('performance-fps').textContent).toBe('50 FPS');
  });

  it('shows that it is measuring before the first window arrives', () => {
    renderOverlay(true);
    expect(screen.getByTestId('performance-overlay').textContent).toBe('Measuring…');
  });

  it('shows nothing while the toggle is off, whatever the store holds (edge case)', () => {
    const store = renderOverlay(false);
    act(() => store.frameMeasured(STATS));
    expect(screen.queryByTestId('performance-overlay')).toBeNull();
  });
});
