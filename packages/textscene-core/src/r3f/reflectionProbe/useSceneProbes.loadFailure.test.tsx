import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../logger';
import { useSceneProbes } from './useSceneProbes';

vi.mock('../../resources/sky/skyLayers.js', () => {
  throw new Error('the chunk did not load');
});

function Holder() {
  useSceneProbes();
  return null;
}

const isProbeLoadFailure = (message: unknown) =>
  typeof message === 'string' &&
  message.startsWith('[ReflectionProbe] The previewer could not load its probe bake');

describe('useSceneProbes when the probe bake fails to load', () => {
  it('warns once that no probe captures (error case)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderer = await ReactThreeTestRenderer.create(<Holder />);

    await vi.waitFor(async () => {
      await renderer.advanceFrames(1, 16);
      expect(warn.mock.calls.some(([message]) => isProbeLoadFailure(message))).toBe(true);
    });
    await renderer.unmount();
    expect(warn.mock.calls.filter(([message]) => isProbeLoadFailure(message))).toHaveLength(1);
    warn.mockRestore();
  });
});
