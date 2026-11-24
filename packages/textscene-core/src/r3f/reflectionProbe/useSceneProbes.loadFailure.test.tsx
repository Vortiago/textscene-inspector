import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../logger';
import { PROBE_BAKE_LOAD_FAILURE, useSceneProbes } from './useSceneProbes';

vi.mock('../../resources/sky/skyLayers.js', () => {
  throw new Error('the chunk did not load');
});

function Holder() {
  useSceneProbes();
  return null;
}

describe('useSceneProbes when the probe bake fails to load', () => {
  it('warns once that no probe captures (error case)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderer = await ReactThreeTestRenderer.create(<Holder />);

    await vi.waitFor(async () => {
      await renderer.advanceFrames(1, 16);
      expect(warn).toHaveBeenCalledWith(PROBE_BAKE_LOAD_FAILURE);
    });
    await renderer.unmount();
    expect(warn.mock.calls.filter(([message]) => message === PROBE_BAKE_LOAD_FAILURE)).toHaveLength(1);
    warn.mockRestore();
  });
});
