/**
 * Which renderer path the spike draws a canvas with, read from the page's `?renderer=` parameter.
 * `classic` is the previewer as it ships. The others exist only on the spike branch.
 */

export type SpikeRenderer = 'classic' | 'handler' | 'webgpu' | 'webgpu-webgl2';

const SPIKE_RENDERERS: readonly SpikeRenderer[] = ['classic', 'handler', 'webgpu', 'webgpu-webgl2'];

/** `classic` outside a browser, without the parameter, or for a value that names no path. */
function requestedRenderer(): SpikeRenderer {
  if (typeof window === 'undefined') return 'classic';
  const requested = new URLSearchParams(window.location.search).get('renderer');
  return SPIKE_RENDERERS.find((renderer) => renderer === requested) ?? 'classic';
}

/** Read once, when the module loads: the app rewrites the URL's query when it opens a scene. */
const REQUESTED = requestedRenderer();

export function spikeRenderer(): SpikeRenderer {
  return REQUESTED;
}
