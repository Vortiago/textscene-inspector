/**
 * AnimationTransportContext tests — the scene-level play/pause/scrub state
 * that the AnimationPlayer Component reads and the Animation dock tab drives.
 */

import { describe, expect, it } from 'vitest';
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
