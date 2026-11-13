/**
 * The probe page: a plain three.js page that runs one transpiled probe function per call on a
 * real GL context. Each pixel of a one-row float target holds one result lane, as the Godot
 * harness writes it (`scripts/godot-probes/probeShader.mjs`), and the page answers its bits.
 */

import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import { float, int, screenCoordinate, select, uniformArray, vec2, vec3, vec4 } from 'three/tsl';
import { installNodesHandler, transpileShadingLanguage } from '@textscene/three-godot-shaders';

const LANES = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
const CONSTRUCT = { vec2, vec3, vec4 };

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'linear');
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

/**
 * The first value of each uniform array, before the inputs. three's upload takes an array whose
 * first value is NaN for an array of vectors (`flatten`, three 0.187 `three.module.js:4815`) and
 * throws, so an input row that starts with NaN needs a number before it.
 */
const LEADING_PAD = 0;

/**
 * The argument node of a parameter, read from a uniform array of the floats of its `bits`. Floats,
 * not uints: three writes every uniform buffer through a `Float32Array`, so a uint over 2^24
 * reaches the GPU rounded, while a float keeps its bits, -0 and NaN included.
 */
function argument(type, bits, row) {
  const floats = Array.from(new Float32Array(new Uint32Array(bits).buffer));
  const values = uniformArray([LEADING_PAD, ...floats], 'float');
  const size = LANES[type];
  const lanes = Array.from({ length: size }, (_, lane) => values.element(row.mul(size).add(lane + 1)));
  return size === 1 ? lanes[0] : CONSTRUCT[type](...lanes);
}

/** Lane `lane` of `result`, a float node for a float result. */
function laneOf(result, size, lane) {
  if (size === 1) return result;
  const components = ['x', 'y', 'z', 'w'].slice(0, size).map((name) => result[name]);
  return components
    .slice(1)
    .reduce((picked, component, index) => select(lane.equal(index + 1), component, picked), components[0]);
}

/**
 * The bits of each result lane of `spec`'s probe over its rows, or `{ error }` when the
 * transpilation refuses the source.
 */
function runProbe(spec) {
  let probe;
  try {
    probe = transpileShadingLanguage(spec.source).functions.get('probe');
    if (!probe) return { error: 'the transpilation has no function probe' };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
  const size = LANES[probe.returnType];
  const width = spec.rows * size;
  const pixel = int(screenCoordinate.x);
  const row = pixel.div(size);
  const lane = pixel.mod(size);
  const args = probe.parameters.map((parameter, index) =>
    argument(parameter.type, spec.parameters[index], row)
  );
  const material = new NodeMaterial();
  material.fragmentNode = vec4(float(laneOf(probe.call(args), size, lane)), 0, 0, 1);
  quad.material = material;
  const target = new THREE.WebGLRenderTarget(width, 1, { type: THREE.FloatType, format: THREE.RGBAFormat });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Float32Array(width * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, 1, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  material.dispose();
  const bits = new Uint32Array(pixels.buffer);
  return { bits: Array.from({ length: width }, (_, index) => bits[index * 4]) };
}

globalThis.runProbe = runProbe;
globalThis.pageReady = true;
