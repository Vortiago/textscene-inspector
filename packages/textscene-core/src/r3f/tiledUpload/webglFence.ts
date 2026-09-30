/**
 * A `GpuFence` over a WebGL2 sync object. The status query never blocks: the browser
 * updates it between tasks, so a frame reads whether the GPU finished the last one's
 * commands without waiting for it.
 */

import type { GpuFence } from './gpuPacer';

export function webglFence(gl: WebGL2RenderingContext): GpuFence {
  let sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  // A fence the GPU never receives never signals.
  gl.flush();
  const dispose = (): void => {
    if (!sync) return;
    gl.deleteSync(sync);
    sync = null;
  };
  return {
    isDone: () => {
      if (!sync) return true;
      if (gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED) return false;
      dispose();
      return true;
    },
    dispose,
  };
}
