import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../logger';
import { useSceneProbes } from './useSceneProbes';

vi.mock('../../shaders/nodesHandler.js', () => {
  throw new Error('the chunk did not load');
});

function Holder() {
  useSceneProbes();
  return null;
}

const isNodesHandlerFailure = (message: unknown) =>
  typeof message === 'string' &&
  message.startsWith('[ReflectionProbe] The previewer could not load its node shaders');

describe('useSceneProbes when the node shaders fail to load', () => {
  it('warns once that no probe captures, naming the node shaders (error case)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderer = await ReactThreeTestRenderer.create(<Holder />);

    await vi.waitFor(async () => {
      await renderer.advanceFrames(1, 16);
      expect(warn.mock.calls.some(([message]) => isNodesHandlerFailure(message))).toBe(true);
    });
    await renderer.unmount();
    expect(warn.mock.calls.filter(([message]) => isNodesHandlerFailure(message))).toHaveLength(1);
    warn.mockRestore();
  });
});
