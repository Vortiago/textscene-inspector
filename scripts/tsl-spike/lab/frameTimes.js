/**
 * Frame times of one draw function: the main thread's time in the draw, and the time until the GPU
 * has finished it, which a software rasteriser spends on the CPU too.
 */

function percentile(sorted, share) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

function summary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
}

/**
 * Resolves when the GPU has finished every command the renderer has sent. A WebGL context has no
 * such promise, and Chromium's `finish` does not wait, so one pixel is read back, which does.
 */
async function gpuFinished(renderer) {
  const device = renderer.backend?.device;
  if (device) return device.queue.onSubmittedWorkDone();
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, ONE_PIXEL);
  return undefined;
}

const ONE_PIXEL = new Uint8Array(4);

export async function frameTimes(renderer, drawFrame, warmUpFrames, measuredFrames) {
  const cpuMs = [];
  const finishedMs = [];
  for (let frame = 0; frame < warmUpFrames + measuredFrames; frame++) {
    const startedAt = performance.now();
    drawFrame();
    const drawnAt = performance.now();
    await gpuFinished(renderer);
    if (frame < warmUpFrames) continue;
    cpuMs.push(drawnAt - startedAt);
    finishedMs.push(performance.now() - startedAt);
  }
  return { frames: measuredFrames, cpuMs: summary(cpuMs), untilGpuFinishedMs: summary(finishedMs) };
}
