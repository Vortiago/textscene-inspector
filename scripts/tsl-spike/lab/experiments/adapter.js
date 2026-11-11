/** What WebGPU adapter the browser gives, and the limits the lit surface's bindings meet. */

/* global document */ // The page runs in the browser.

const LIMITS = [
  'maxSampledTexturesPerShaderStage',
  'maxSamplersPerShaderStage',
  'maxUniformBuffersPerShaderStage',
  'maxBindGroups',
  'maxBindingsPerBindGroup',
  'maxTextureArrayLayers',
  'maxTextureDimension2D',
  'maxColorAttachments',
  'maxUniformBufferBindingSize',
];

export async function run() {
  if (!navigator.gpu) return { hasWebGpu: false };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { hasWebGpu: true, adapter: null };
  const { vendor, architecture, device, description } = adapter.info;
  return {
    hasWebGpu: true,
    adapter: { vendor, architecture, device, description, isFallbackAdapter: adapter.info.isFallbackAdapter },
    limits: Object.fromEntries(LIMITS.map((name) => [name, adapter.limits[name]])),
    features: [...adapter.features].sort(),
    webgl2: webgl2Limits(),
  };
}

function webgl2Limits() {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return null;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
    maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
  };
}
