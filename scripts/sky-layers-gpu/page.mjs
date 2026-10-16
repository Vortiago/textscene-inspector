/**
 * The browser side of the sky layer gate: bakes the layers of made-up skies with the real passes
 * and reads every texel of every layer back, so the gate can judge what the shaders wrote.
 */
import * as THREE from 'three';
import {
  bakeSkyLayers,
  disposeSkyLayers,
} from '../../packages/textscene-core/src/resources/sky/skyLayers.ts';

/* global window, document */
// `window` and `document` exist only in the browser that loads this page.

/** A radiance size the importance filter reads, small enough for a fast bake. */
const RADIANCE_SIZE = 64;

/** The uniform sky's radiance, a colour whose channels differ so a swizzle shows. */
const UNIFORM_RADIANCE = [0.25, 0.5, 1];

/** The bright face of the high-contrast sky, +Y, which the fast filter's negative taps reach. */
const BRIGHT_FACE = 2;
const BRIGHT_RADIANCE = [8, 8, 8];

THREE.ColorManagement.enabled = false;
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });

/** The radiance cube of a sky whose face `face` has `colourOf(face)`. */
function radianceCube(colourOf) {
  const cube = new THREE.WebGLCubeRenderTarget(RADIANCE_SIZE, { type: THREE.HalfFloatType });
  for (let face = 0; face < 6; face += 1) {
    renderer.setRenderTarget(cube, face);
    renderer.setClearColor(new THREE.Color(...colourOf(face)), 1);
    renderer.clear();
  }
  renderer.setRenderTarget(null);
  return cube;
}

/**
 * The range of every channel over each mip of each layer the bake wrote, and how many of its values
 * are not finite. The ranges are enough for each check, and keep the page's answer small.
 */
function rangesOf({ layout, target }) {
  const gl = renderer.getContext();
  const mipSizes = [layout.size, ...layout.downsampledSizes];
  const ranges = [];
  for (let layer = 0; layer < target.depth; layer += 1) {
    mipSizes.forEach((size, mip) => {
      const pixels = new Float32Array(size * size * 4);
      renderer.setRenderTarget(target, layer, mip);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, pixels);
      ranges.push(rangeOf(layer, mip, pixels));
    });
  }
  renderer.setRenderTarget(null);
  return ranges;
}

function rangeOf(layer, mip, pixels) {
  const range = {
    layer,
    mip,
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    nonFinite: 0,
  };
  for (let at = 0; at < pixels.length; at += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[at + channel];
      if (!Number.isFinite(value)) range.nonFinite += 1;
      else {
        range.min[channel] = Math.min(range.min[channel], value);
        range.max[channel] = Math.max(range.max[channel], value);
      }
    }
  }
  return range;
}

/** The ranges of the layers `radianceFilter` bakes from the sky `colourOf` describes. */
function bake(colourOf, radianceFilter) {
  const radiance = radianceCube(colourOf);
  const layers = bakeSkyLayers(renderer, radiance.texture, { radianceFilter, radianceSize: RADIANCE_SIZE });
  const ranges = rangesOf(layers);
  disposeSkyLayers(layers);
  radiance.dispose();
  return ranges;
}

const highContrast = (face) => (face === BRIGHT_FACE ? BRIGHT_RADIANCE : [0, 0, 0]);

window.skyLayerSamples = () => ({
  uniformRadiance: UNIFORM_RADIANCE,
  uniformImportance: bake(() => UNIFORM_RADIANCE, 'importance-sample'),
  uniformFast: bake(() => UNIFORM_RADIANCE, 'fast'),
  highContrastFast: bake(highContrast, 'fast'),
});
