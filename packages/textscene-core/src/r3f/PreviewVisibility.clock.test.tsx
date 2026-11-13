/**
 * An animation and a particle emitter step by the delta their frame callback receives. R3F
 * restarts the clock when the loop resumes, so the first frame after a long hide gets a normal
 * frame's delta, not the time spent hidden.
 */
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame, useThree, type RootState } from '@react-three/fiber';

const HIDDEN_MS = 30_000;

afterEach(() => vi.restoreAllMocks());

function Probe({ deltas, onStore }: { deltas: number[]; onStore: (get: () => RootState) => void }): null {
  useFrame((_state, delta) => {
    deltas.push(delta);
  });
  const get = useThree((state) => state.get);
  useEffect(() => onStore(get), [get, onStore]);
  return null;
}

describe('the first frame after a hidden preview shows again', () => {
  it('receives a normal frame delta, not the time spent hidden', async () => {
    const deltas: number[] = [];
    let get!: () => RootState;
    await ReactThreeTestRenderer.create(
      <Probe
        deltas={deltas}
        onStore={(read) => {
          get = read;
        }}
      />
    );
    const state = get();
    const realNow = performance.now.bind(performance);
    state.setFrameloop('always');
    state.advance(0);
    state.setFrameloop('never');

    const hiddenAt = realNow();
    vi.spyOn(performance, 'now').mockImplementation(() => hiddenAt + HIDDEN_MS);
    state.setFrameloop('always');
    deltas.length = 0;
    state.advance(0);

    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toBeLessThan(1);
  });
});
