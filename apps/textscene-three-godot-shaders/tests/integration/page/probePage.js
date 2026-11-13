/**
 * The probe page: a plain three.js page that runs one translated probe function per call on a
 * real GL context. Each pixel of a one-row float target holds one result lane, as the Godot
 * harness writes it (`scripts/godot-probes/probeShader.mjs`), and the page answers its bits.
 */

import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  float,
  int,
  screenCoordinate,
  select,
  uintBitsToFloat,
  uniformArray,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { installNodesHandler, translateShadingLanguage } from '@textscene/three-godot-shaders';

const LANES = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
const CONSTRUCT = { vec2, vec3, vec4 };

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'linear');
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

/** The argument node of parameter `index`, read from its uniform array of bits. */
function argument(type, bits, row) {
  const values = uniformArray(bits, 'uint');
  const size = LANES[type];
  const lanes = Array.from({ length: size }, (_, lane) =>
    uintBitsToFloat(values.element(row.mul(size).add(lane)))
  );
  return size === 1 ? lanes[0] : CONSTRUCT[type](...lanes);
}

/** Lane `lane` of `result`, a float node for a float result. */
function laneOf(result, size, lane) {
  const components = ['x', 'y', 'z', 'w'].slice(0, size).map((name) => result[name]);
  if (size === 1) return result;
  return components
    .slice(1)
    .reduce((picked, component, index) => select(lane.equal(index + 1), component, picked), components[0]);
}

/**
 * The bits of each result lane of `spec`'s probe over its rows, or `{ error }` when the
 * translation refuses the source.
 */
function runProbe(spec) {
  let probe;
  try {
    probe = translateShadingLanguage(spec.source).functions.get('probe');
    if (!probe) return { error: 'the translation has no function probe' };
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
