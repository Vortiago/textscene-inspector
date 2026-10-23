import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FrameStatsProvider, useFrameStats, useFrameStatsStore } from './FrameStatsContext';
import type { FrameStats } from './frameStats';

const STATS: FrameStats = {
  fps: 60,
  frameMs: 16.7,
  cpuMs: 2,
  gpuMs: null,
  drawCallsPerFrame: 0,
  hasGpuTimer: false,
  rendersInSoftware: false,
  steps: [{ step: 'Other', cpuMs: 2, gpuMs: null, runsPerFrame: 1, drawCallsPerFrame: 0 }],
};

function provider({ children }: { children: ReactNode }) {
  return <FrameStatsProvider>{children}</FrameStatsProvider>;
}

describe('useFrameStats', () => {
  it('re-renders with each window the store publishes', () => {
    const { result } = renderHook(() => ({ stats: useFrameStats(), store: useFrameStatsStore() }), {
      wrapper: provider,
    });
    act(() => result.current.store.set(STATS));
    expect(result.current.stats).toBe(STATS);
  });

  it('is null before a profile publishes its first window', () => {
    const { result } = renderHook(() => useFrameStats(), { wrapper: provider });
    expect(result.current).toBeNull();
  });

  it('is null with no provider, whose stand-in store nothing reads (edge case)', () => {
    const { result } = renderHook(() => useFrameStats());
    expect(result.current).toBeNull();
  });
});

describe('FrameStatsProvider', () => {
  it('gives each provider a store of its own, so two previews never share a window', () => {
    const first = renderHook(() => useFrameStatsStore(), { wrapper: provider });
    const second = renderHook(() => useFrameStatsStore(), { wrapper: provider });
    expect(first.result.current).not.toBe(second.result.current);
  });
});
