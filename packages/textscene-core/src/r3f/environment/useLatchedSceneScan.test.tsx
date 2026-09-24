/**
 * The scan sees content that arrives after any fixed delay, and keeps its answer once it holds.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useLatchedSceneScan } from './useLatchedSceneScan';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** A predicate the test flips, standing in for a material that turns emissive when its texture loads. */
function switchablePredicate() {
  const state = { holds: false };
  return { state, scan: () => state.holds };
}

async function mount(scan: (() => boolean) | null) {
  const seen = { found: false };
  function Probe() {
    seen.found = useLatchedSceneScan(scan);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(<Probe />);
  return { renderer, seen };
}

const advance = (renderer: Renderer, frames: number) =>
  ReactThreeTestRenderer.act(() => renderer.advanceFrames(frames, 0));

describe('useLatchedSceneScan', () => {
  it('finds content that arrives many frames after the mount', async () => {
    const { state, scan } = switchablePredicate();
    const { renderer, seen } = await mount(scan);
    await advance(renderer, 100);
    expect(seen.found).toBe(false);

    state.holds = true;
    await advance(renderer, 1);

    expect(seen.found).toBe(true);
  });

  it('keeps its answer after the predicate stops holding', async () => {
    const { state, scan } = switchablePredicate();
    const { renderer, seen } = await mount(scan);
    state.holds = true;
    await advance(renderer, 1);

    state.holds = false;
    await advance(renderer, 3);

    expect(seen.found).toBe(true);
  });

  it('never finds anything with a null predicate', async () => {
    const { renderer, seen } = await mount(null);
    await advance(renderer, 3);

    expect(seen.found).toBe(false);
  });
});
