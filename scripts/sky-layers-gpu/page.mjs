/**
 * The browser side of the sky layer gate: bakes the layers of made-up skies with the real passes
 * and reads every texel of every layer back, so the gate can judge what the shaders wrote.
 */
import * as THREE from 'three';
import { installNodesHandler } from '../../packages/textscene-core/src/shaders/nodesHandler.ts';
import { disposeSkyLayers } from '../../packages/textscene-core/src/resources/sky/octmapArrays.ts';
import { bakeSkyLayers } from '../../packages/textscene-core/src/resources/sky/skyLayers.testkit.ts';
import { REAL_TIME_RADIANCE_SIZE } from '../../packages/textscene-core/src/godot/rendering/environment/skyReflection.ts';

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
// The bake draws Godot's compute stages as node materials, which write linear values here.
installNodesHandler(renderer, 'linear');

/** The radiance cube of a sky whose face `face` has `colourOf(face)`. */
function radianceCube(colourOf, size = RADIANCE_SIZE) {
  const cube = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
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
  const layers = bakeSkyLayers(
    renderer,
    radiance.texture,
    { radianceFilter, radianceSize: RADIANCE_SIZE },
    0
  );
  const ranges = rangesOf(layers);
  disposeSkyLayers(layers);
  radiance.dispose();
  return ranges;
}

const highContrast = (face) => (face === BRIGHT_FACE ? BRIGHT_RADIANCE : [0, 0, 0]);

/** A sky of one colour above, +Y, another below, -Y, and grey at the sides, which shows a flipped mip. */
const TWO_COLOURS = { top: [1, 0.8, 0.3], bottom: [0.1, 0.4, 0.1] };
const BOTTOM_FACE = 3;
const twoColour = (face) =>
  face === BRIGHT_FACE ? TWO_COLOURS.top : face === BOTTOM_FACE ? TWO_COLOURS.bottom : [0.5, 0.5, 0.5];

/** The texel of `mip` of `layer` at `x`, `y`. */
function texelAt(target, layer, mip, x, y) {
  const gl = renderer.getContext();
  const pixel = new Float32Array(4);
  renderer.setRenderTarget(target, layer, mip);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.FLOAT, pixel);
  return Array.from(pixel.slice(0, 3));
}

/** The +Y and -Y texels of each mip of each layer: +Y is the middle of the top edge inside the border. */
function orientationOf({ layout, target }) {
  const pad = (1 - layout.borderSize) / 2;
  const texels = [];
  for (let layer = 0; layer < target.depth; layer += 1)
    [layout.size, ...layout.downsampledSizes].forEach((size, mip) => {
      const inset = Math.floor(pad * size) + 1;
      const middle = size >> 1;
      const up = texelAt(target, layer, mip, middle, size - 1 - inset);
      texels.push({ layer, mip, up, down: texelAt(target, layer, mip, middle, inset) });
    });
  renderer.setRenderTarget(null);
  return texels;
}

/** The orientation of the layers `radianceFilter` bakes from the two-colour sky, at `radianceSize`. */
function bakeTwoColour(radianceFilter, radianceSize) {
  const radiance = radianceCube(twoColour, radianceSize);
  const layers = bakeSkyLayers(renderer, radiance.texture, { radianceFilter, radianceSize }, 0);
  const texels = orientationOf(layers);
  disposeSkyLayers(layers);
  radiance.dispose();
  return texels;
}

window.skyLayerSamples = () => ({
  uniformRadiance: UNIFORM_RADIANCE,
  uniformImportance: bake(() => UNIFORM_RADIANCE, 'importance-sample'),
  uniformFast: bake(() => UNIFORM_RADIANCE, 'fast'),
  highContrastFast: bake(highContrast, 'fast'),
  twoColours: TWO_COLOURS,
  twoColourImportance: bakeTwoColour('importance-sample', RADIANCE_SIZE),
  twoColourFast: bakeTwoColour('fast', REAL_TIME_RADIANCE_SIZE),
});
