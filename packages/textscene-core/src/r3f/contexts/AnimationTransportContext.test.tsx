/** The scene-level play, pause and scrub state that the Animation tab drives. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type PlayerRegistration,
} from './AnimationTransportContext';

function wrap({ children }: { children: ReactNode }) {
  return <AnimationTransportProvider>{children}</AnimationTransportProvider>;
}

const REG: PlayerRegistration = {
  clips: ['idle', 'walk'],
  durations: { idle: 1.0, walk: 0.8 },
  autoplay: 'walk',
};

describe('AnimationTransportContext — initial state', () => {
  it('starts stopped with no clips and no selection', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    expect(result.current.clips).toEqual([]);
    expect(result.current.selectedClip).toBeNull();
    expect(result.current.playState).toBe('stopped');
    expect(result.current.time).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.hasPlayer).toBe(false);
  });
});

describe('AnimationTransportContext — hasPlayer (drives Animation tab visibility)', () => {
  it('is true while a player is registered — even one with no clips', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    let unregister = () => {};
    act(() => {
      unregister = result.current.registerPlayer({ clips: [], durations: {} });
    });
    expect(result.current.hasPlayer).toBe(true); // selected AnimationPlayer, no animations
    act(() => unregister());
    expect(result.current.hasPlayer).toBe(false);
  });
});

describe('AnimationTransportContext — registration (F1)', () => {
  it('exposes the registered clips and pre-selects the autoplay clip', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer(REG));
    expect(result.current.clips).toEqual(['idle', 'walk']);
    expect(result.current.selectedClip).toBe('walk');
    expect(result.current.duration).toBe(0.8);
  });

  it('falls back to the first clip when autoplay is absent', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer({ clips: ['a', 'b'], durations: { a: 1, b: 2 } }));
    expect(result.current.selectedClip).toBe('a');
  });

  it('skips RESET when defaulting — pre-selects the first non-RESET clip', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() =>
      void result.current.registerPlayer({
        clips: ['RESET', 'idle', 'walk'],
        durations: { RESET: 0, idle: 1, walk: 0.8 },
      })
    );
    expect(result.current.selectedClip).toBe('idle');
  });

  it('selects RESET only when it is the sole clip', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer({ clips: ['RESET'], durations: { RESET: 0 } }));
    expect(result.current.selectedClip).toBe('RESET');
  });

  it('exposes the autoplay clip so the panel can mark it', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer(REG)); // autoplay: 'walk'
    expect(result.current.autoplayClip).toBe('walk');
  });

  it('exposes a null autoplay clip when the player has no autoplay', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer({ clips: ['a'], durations: { a: 1 } }));
    expect(result.current.autoplayClip).toBeNull();
  });

  it('resets to empty when the player unregisters (F4)', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    let unregister = () => {};
    act(() => {
      unregister = result.current.registerPlayer(REG);
    });
    act(() => {
      result.current.play();
      unregister();
    });
    expect(result.current.clips).toEqual([]);
    expect(result.current.selectedClip).toBeNull();
    expect(result.current.playState).toBe('stopped');
    expect(result.current.time).toBe(0);
  });
});

describe('AnimationTransportContext — controls (F2/F3)', () => {
  function setup() {
    const hook = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void hook.result.current.registerPlayer(REG));
    return hook;
  }

  it('play / pause / stop move the play state and stop resets time', () => {
    const { result } = setup();
    act(() => result.current.seek(0.4));
    act(() => result.current.play());
    expect(result.current.playState).toBe('playing');
    act(() => result.current.pause());
    expect(result.current.playState).toBe('paused');
    expect(result.current.time).toBe(0.4);
    act(() => result.current.stop());
    expect(result.current.playState).toBe('stopped');
    expect(result.current.time).toBe(0);
  });

  it('selectClip changes the selection, its duration, and resets time', () => {
    const { result } = setup();
    act(() => result.current.seek(0.5));
    act(() => result.current.selectClip('idle'));
    expect(result.current.selectedClip).toBe('idle');
    expect(result.current.duration).toBe(1.0);
    expect(result.current.time).toBe(0);
  });

  it('seek clamps to [0, duration]', () => {
    const { result } = setup(); // selected 'walk', duration 0.8
    act(() => result.current.seek(99));
    expect(result.current.time).toBe(0.8);
    act(() => result.current.seek(-5));
    expect(result.current.time).toBe(0);
  });

  it('reportTime updates the playhead for the scrubber readout', () => {
    const { result } = setup();
    act(() => result.current.reportTime(0.25));
    expect(result.current.time).toBeCloseTo(0.25);
  });
});

describe('AnimationTransportContext — reportTime throttling (WI-213)', () => {
  function setup() {
    const hook = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void hook.result.current.registerPlayer(REG));
    return hook;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits the first reportTime call immediately (no artificial initial delay)', () => {
    const { result } = setup();
    act(() => result.current.reportTime(0.1));
    expect(result.current.time).toBeCloseTo(0.1);
  });

  it('coalesces rapid reportTime calls within the throttle window into one commit', () => {
    const { result } = setup();
    act(() => result.current.reportTime(0.1));
    expect(result.current.time).toBeCloseTo(0.1);

    // One frame at 60 fps, well inside the 10 Hz window.
    act(() => {
      vi.advanceTimersByTime(16);
      result.current.reportTime(0.11);
    });
    expect(result.current.time).toBeCloseTo(0.1); // still the throttled value

    act(() => {
      vi.advanceTimersByTime(16);
      result.current.reportTime(0.12);
    });
    expect(result.current.time).toBeCloseTo(0.1);
  });

  it('commits again once the throttle window elapses', () => {
    const { result } = setup();
    act(() => result.current.reportTime(0.1));

    act(() => {
      vi.advanceTimersByTime(16);
      result.current.reportTime(0.11); // still throttled
    });
    expect(result.current.time).toBeCloseTo(0.1);

    act(() => {
      vi.advanceTimersByTime(200); // well past the throttle window
      result.current.reportTime(0.5);
    });
    expect(result.current.time).toBeCloseTo(0.5);
  });

  it('an immediate reportTime call bypasses the throttle window', () => {
    const { result } = setup();
    act(() => result.current.reportTime(0.1));

    act(() => {
      vi.advanceTimersByTime(16); // well inside the throttle window
      result.current.reportTime(0.33, { immediate: true });
    });
    expect(result.current.time).toBeCloseTo(0.33);
  });
});

describe('AnimationTransportContext — playback speed (#224)', () => {
  it('starts at 1x (no change from the authored speed)', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    expect(result.current.playbackSpeed).toBe(1);
  });

  it('setPlaybackSpeed updates the multiplier', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => result.current.setPlaybackSpeed(2));
    expect(result.current.playbackSpeed).toBe(2);
  });

  it('ignores a non-positive or non-finite speed (would silently freeze/reverse playback)', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => result.current.setPlaybackSpeed(0));
    expect(result.current.playbackSpeed).toBe(1);
    act(() => result.current.setPlaybackSpeed(2));
    act(() => result.current.setPlaybackSpeed(-1));
    expect(result.current.playbackSpeed).toBe(1);
    act(() => result.current.setPlaybackSpeed(2));
    act(() => result.current.setPlaybackSpeed(NaN));
    expect(result.current.playbackSpeed).toBe(1);
  });

  it('resets to 1x when a new player registers — a fresh selection starts neutral', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer(REG));
    act(() => result.current.setPlaybackSpeed(2));
    act(() => void result.current.registerPlayer({ clips: ['a'], durations: { a: 1 } }));
    expect(result.current.playbackSpeed).toBe(1);
  });
});

describe('AnimationTransportContext — loop override (#224)', () => {
  it('starts on "auto" (respects each clip\'s authored loop behavior)', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    expect(result.current.loopOverride).toBe('auto');
  });

  it('setLoopOverride updates the mode', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => result.current.setLoopOverride('once'));
    expect(result.current.loopOverride).toBe('once');
  });

  it('resets to "auto" when a new player registers', () => {
    const { result } = renderHook(() => useAnimationTransport(), { wrapper: wrap });
    act(() => void result.current.registerPlayer(REG));
    act(() => result.current.setLoopOverride('loop'));
    act(() => void result.current.registerPlayer({ clips: ['a'], durations: { a: 1 } }));
    expect(result.current.loopOverride).toBe('auto');
  });
});
