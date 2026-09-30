import { describe, expect, it, vi } from 'vitest';
import { webglFence } from './webglFence';

const SYNC_GPU_COMMANDS_COMPLETE = 0x9117;
const SYNC_STATUS = 0x9114;
const SIGNALED = 0x9119;
const UNSIGNALED = 0x9118;

function fakeGl(sync: object | null = {}) {
  let status = UNSIGNALED;
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE,
    SYNC_STATUS,
    SIGNALED,
    fenceSync: vi.fn(() => sync),
    flush: vi.fn(),
    getSyncParameter: vi.fn(() => status),
    deleteSync: vi.fn(),
  };
  return { gl: gl as unknown as WebGL2RenderingContext, calls: gl, signal: () => (status = SIGNALED) };
}

describe('webglFence', () => {
  it('fences every command issued so far, and flushes them to the GPU', () => {
    const { gl, calls } = fakeGl();
    webglFence(gl);

    expect(calls.fenceSync).toHaveBeenCalledWith(SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(calls.flush).toHaveBeenCalledTimes(1);
  });

  it('reads the status without waiting, until the GPU signals it', () => {
    const { gl, signal } = fakeGl();
    const fence = webglFence(gl);
    expect(fence.isDone()).toBe(false);
    signal();

    expect(fence.isDone()).toBe(true);
  });

  it('deletes the sync once, when it first reads as done', () => {
    const { gl, calls, signal } = fakeGl();
    const fence = webglFence(gl);
    signal();
    fence.isDone();
    fence.isDone();

    expect(calls.deleteSync).toHaveBeenCalledTimes(1);
    expect(calls.getSyncParameter).toHaveBeenCalledTimes(1);
  });

  it('counts as done when the context gives no sync, as a lost one does', () => {
    const { gl } = fakeGl(null);

    expect(webglFence(gl).isDone()).toBe(true);
  });
});
