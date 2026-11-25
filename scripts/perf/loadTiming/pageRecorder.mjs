/* global document, window, MutationObserver, WebGL2RenderingContext */

/** The prefix of each console line the recorder writes, which `recordLoadTiming` reads. */
export const LOAD_TIMING_PREFIX = '[load-timing] ';

/** An init script that logs a page's load as `prefix` + JSON lines: navigation, canvas, draws, long tasks. */
export function installPageRecorder(prefix) {
  const emit = (event) =>
    console.log(prefix + JSON.stringify({ at: Math.round(performance.now()), ...event }));
  emit({ kind: 'navigate', search: window.location.search });

  const shaderLengths = new WeakMap();
  const programShaders = new WeakMap();
  const drawn = new WeakSet();
  const pixel = new Uint8Array(4);
  const gl = WebGL2RenderingContext.prototype;
  const { shaderSource, attachShader, useProgram } = gl;
  let current = null;
  gl.shaderSource = function (shader, source) {
    shaderLengths.set(shader, source.length);
    return shaderSource.call(this, shader, source);
  };
  gl.attachShader = function (program, shader) {
    programShaders.set(program, [...(programShaders.get(program) ?? []), shaderLengths.get(shader)]);
    return attachShader.call(this, program, shader);
  };
  gl.useProgram = function (program) {
    current = program;
    return useProgram.call(this, program);
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const draw = gl[name];
    gl[name] = function (...args) {
      if (!current || drawn.has(current)) return draw.apply(this, args);
      drawn.add(current);
      const start = performance.now();
      const result = draw.apply(this, args);
      // A read waits for the GPU process, which `finish` does not in Chromium: the time holds earlier work.
      this.readPixels(0, 0, 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
      this.getError();
      const ms = Math.round(performance.now() - start);
      emit({ kind: 'first-draw', ms, shaderLengths: programShaders.get(current) ?? [] });
      return result;
    };
  }

  new PerformanceObserver((list) => {
    for (const task of list.getEntries()) {
      emit({ kind: 'long-task', ms: Math.round(task.duration), from: Math.round(task.startTime) });
    }
  }).observe({ type: 'longtask', buffered: true });

  const watchCanvas = () => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('canvas')) return;
      observer.disconnect();
      emit({ kind: 'canvas' });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) watchCanvas();
  else document.addEventListener('DOMContentLoaded', watchCanvas, { once: true });
  window.addEventListener('load', () => emit({ kind: 'load' }));
}
