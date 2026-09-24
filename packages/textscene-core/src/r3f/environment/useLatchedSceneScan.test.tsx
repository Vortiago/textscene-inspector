/**
 * The scan sees content that loads after any fixed delay, keeps its answer once it holds, and
 * stops a few frames after the loader settles, so a later click cannot switch the pipeline.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderContext } from '../../resources/ResourceLoaderContext';
import { SCAN_FRAMES_AFTER_SETTLE, useLatchedSceneScan } from './useLatchedSceneScan';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** A predicate the test flips, standing in for a material that turns emissive when its texture loads. */
function switchablePredicate() {
  const state = { holds: false };
  return { state, scan: () => state.holds };
}

async function mount(scan: (() => boolean) | null, loader = new ResourceLoader()) {
  const seen = { found: false };
  function Probe() {
    seen.found = useLatchedSceneScan(scan);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderContext.Provider value={loader}>
      <Probe />
    </ResourceLoaderContext.Provider>
  );
  return { renderer, seen };
}

const advance = (renderer: Renderer, frames: number) =>
  ReactThreeTestRenderer.act(() => renderer.advanceFrames(frames, 0));

describe('useLatchedSceneScan', () => {
  it('finds content that loads many frames after the mount', async () => {
    const loader = new ResourceLoader();
    const release = loader.beginPending();
    const { state, scan } = switchablePredicate();
    const { renderer, seen } = await mount(scan, loader);
    await advance(renderer, 100);
    expect(seen.found).toBe(false);

    state.holds = true;
    release();
    await advance(renderer, 1);

    expect(seen.found).toBe(true);
  });

  it('finds content that commits within the frames after the loader settles', async () => {
    const { state, scan } = switchablePredicate();
    const { renderer, seen } = await mount(scan);
    await advance(renderer, SCAN_FRAMES_AFTER_SETTLE - 1);

    state.holds = true;
    await advance(renderer, 1);

    expect(seen.found).toBe(true);
  });

  it('ignores content added after the scan stops, such as a selection overlay', async () => {
    const { state, scan } = switchablePredicate();
    const { renderer, seen } = await mount(scan);
    await advance(renderer, SCAN_FRAMES_AFTER_SETTLE);

    state.holds = true;
    await advance(renderer, 3);

    expect(seen.found).toBe(false);
  });

  it('scans again while a later load is pending', async () => {
    const loader = new ResourceLoader();
    const { state, scan } = switchablePredicate();
    const { renderer, seen } = await mount(scan, loader);
    await advance(renderer, SCAN_FRAMES_AFTER_SETTLE);

    const release = loader.beginPending();
    state.holds = true;
    await advance(renderer, 1);
    release();

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
