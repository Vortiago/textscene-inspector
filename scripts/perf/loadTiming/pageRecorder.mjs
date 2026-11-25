/* global document, window, MutationObserver, WebGL2RenderingContext */

/** The prefix of each console line the recorder writes, which `recordLoadTimingWhenOn` reads. */
export const LOAD_TIMING_PREFIX = '[load-timing] ';

/** An init script that logs a page's load as `prefix` + JSON lines: navigation, canvas, draws, long tasks. */
export function installPageRecorder(prefix) {
  // A frame or the blank first document would start a new load in the timeline of its page.
  if (window !== window.top || window.location.protocol === 'about:') return;
  const emit = (event) =>
    console.log(prefix + JSON.stringify({ at: Math.round(performance.now()), ...event }));
  emit({ kind: 'navigate', search: window.location.search });

  const shaderLengths = new WeakMap();
  const programShaders = new WeakMap();
  const currentProgram = new WeakMap();
  const drawn = new WeakSet();
  const pixel = new Uint8Array(4);
  const gl = WebGL2RenderingContext.prototype;
  const { shaderSource, attachShader, useProgram } = gl;
  gl.shaderSource = function (shader, source) {
    shaderLengths.set(shader, source.length);
    return shaderSource.call(this, shader, source);
  };
  gl.attachShader = function (program, shader) {
    if (!programShaders.has(program)) programShaders.set(program, []);
    programShaders.get(program).push(shader);
    return attachShader.call(this, program, shader);
  };
  gl.useProgram = function (program) {
    currentProgram.set(this, program);
    return useProgram.call(this, program);
  };
  // A default-framebuffer read waits for the GPU, unlike `finish`: a bound one can refuse it, multisampled.
  const waitForGpu = (context) => {
    const readFramebuffer = context.getParameter(context.READ_FRAMEBUFFER_BINDING);
    const packBuffer = context.getParameter(context.PIXEL_PACK_BUFFER_BINDING);
    context.bindFramebuffer(context.READ_FRAMEBUFFER, null);
    context.bindBuffer(context.PIXEL_PACK_BUFFER, null);
    context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
    context.bindBuffer(context.PIXEL_PACK_BUFFER, packBuffer);
    context.bindFramebuffer(context.READ_FRAMEBUFFER, readFramebuffer);
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const draw = gl[name];
    gl[name] = function (...args) {
      const program = currentProgram.get(this);
      if (!program || drawn.has(program)) return draw.apply(this, args);
      drawn.add(program);
      const start = performance.now();
      const result = draw.apply(this, args);
      waitForGpu(this);
      const ms = Math.round(performance.now() - start);
      const lengths = (programShaders.get(program) ?? []).map((shader) => shaderLengths.get(shader) ?? 0);
      emit({ kind: 'first-draw', ms, shaderLengths: lengths });
      return result;
    };
  }

  new PerformanceObserver((list) => {
    for (const task of list.getEntries()) {
      emit({ kind: 'long-task', ms: Math.round(task.duration), from: Math.round(task.startTime) });
    }
  }).observe({ type: 'longtask', buffered: true });

  const canvases = document.getElementsByTagName('canvas');
  const watchCanvas = () => {
    if (canvases.length > 0) {
      emit({ kind: 'canvas' });
      return;
    }
    const observer = new MutationObserver(() => {
      if (canvases.length === 0) return;
      observer.disconnect();
      emit({ kind: 'canvas' });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) watchCanvas();
  else document.addEventListener('DOMContentLoaded', watchCanvas, { once: true });
  window.addEventListener('load', () => emit({ kind: 'load' }));
}
