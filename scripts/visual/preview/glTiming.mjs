/* global document, window, MutationObserver, WebGL2RenderingContext */ // Browser globals.

/** Prints the page's `[gltiming]` console lines on the runner's log, each with the runner's clock. */
export function printTimingLines(page) {
  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[gltiming]')) console.log(`${new Date().toISOString()} ${text}`);
  });
}

/** Logs first draws, the canvas insert and long tasks, in ms since navigation start. */
export function installTimingLog() {
  const pixel = new Uint8Array(4);
  // `finish` returns at once in Chromium; a read is the call that waits for the draws before it.
  const waitForGpu = (gl) => {
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.getError();
  };
  const log = (text) => console.log(`[gltiming] ${Math.round(performance.now())} ${text}`);
  log(`navigate ${window.location.search}`);
  const shaderLengths = new WeakMap();
  const programLengths = new WeakMap();
  const drawn = new WeakSet();
  const prototype = WebGL2RenderingContext.prototype;
  const shaderSource = prototype.shaderSource;
  prototype.shaderSource = function (shader, source) {
    shaderLengths.set(shader, source.length);
    return shaderSource.call(this, shader, source);
  };
  const attachShader = prototype.attachShader;
  prototype.attachShader = function (program, shader) {
    programLengths.set(program, [...(programLengths.get(program) ?? []), shaderLengths.get(shader)]);
    return attachShader.call(this, program, shader);
  };
  let current = null;
  const useProgram = prototype.useProgram;
  prototype.useProgram = function (program) {
    current = program;
    return useProgram.call(this, program);
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const draw = prototype[name];
    prototype[name] = function (...args) {
      if (!current || drawn.has(current)) return draw.apply(this, args);
      const program = current;
      drawn.add(program);
      const start = performance.now();
      const result = draw.apply(this, args);
      waitForGpu(this);
      log(`first-draw ${Math.round(performance.now() - start)} ms, shaders ${programLengths.get(program)}`);
      return result;
    };
  }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      log(`longtask ${Math.round(entry.duration)} ms from ${Math.round(entry.startTime)}`);
  }).observe({ type: 'longtask', buffered: true });
  const watchCanvas = () => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('canvas')) return;
      log('canvas inserted');
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) watchCanvas();
  else document.addEventListener('DOMContentLoaded', watchCanvas, { once: true });
  window.addEventListener('load', () => log('load'));
}
