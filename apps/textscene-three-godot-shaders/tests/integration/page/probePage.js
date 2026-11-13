/**
 * The probe page: a plain three.js page that runs one transpiled probe function per call on a
 * real GL context. Each pixel of a one-row RGBA8 target holds the four bytes of one result lane's
 * bits, as the Godot harness writes them (`scripts/godot-probes/probeShader.mjs`), and the page
 * answers those bits.
 */

import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import {
  bvec2,
  bvec3,
  bvec4,
  float,
  floatBitsToUint,
  int,
  ivec2,
  ivec3,
  ivec4,
  mat2,
  mat3,
  mat4,
  screenCoordinate,
  select,
  uint,
  uintBitsToFloat,
  uniformArray,
  uvec2,
  uvec3,
  uvec4,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { installNodesHandler, transpileShadingLanguage } from '@textscene/three-godot-shaders';

const CONSTRUCT = {
  bvec2,
  bvec3,
  bvec4,
  ivec2,
  ivec3,
  ivec4,
  uvec2,
  uvec3,
  uvec4,
  vec2,
  vec3,
  vec4,
  mat2,
  mat3,
  mat4,
};

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'linear');
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

/** The info log of the program the last render failed to compile. Cleared before each render. */
let shaderError;
renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
  shaderError = [fragmentShader, vertexShader]
    .map((shader) => gl.getShaderInfoLog(shader))
    .join('')
    .trim();
};

/**
 * A lane of each scalar kind from its 32 bits, and the 32 bits of a lane. An int lane goes through
 * a variable: three writes `uint` of a negative int constant as `0u` (`ConstNode.generate`).
 */
const LANE_OF_BITS = {
  float: (bits) => uintBitsToFloat(bits),
  int: (bits) => int(bits),
  uint: (bits) => bits,
  bool: (bits) => bits.notEqual(uint(0)),
};
const BITS_OF = {
  float: (lane) => floatBitsToUint(lane),
  int: (lane) => uint(lane.toVar()),
  uint: (lane) => lane,
  bool: (lane) => select(lane, uint(1), uint(0)),
};

/**
 * The argument node of a parameter. Each lane's bits arrive as two 16-bit halves in a float
 * uniform array: three writes every uniform buffer through a `Float32Array`, and a float holds a
 * 16-bit integer exactly, where a float of the whole bits could lose a NaN's payload.
 */
function argument(type, shape, bits, row) {
  const halves = bits.flatMap((value) => [value & 0xffff, value >>> 16]);
  const values = uniformArray(halves, 'float');
  const { scalar, lanes: size, columns } = shape;
  const laneBits = (lane) => {
    const index = row.mul(size).add(lane).mul(2);
    return uint(values.element(index)).bitOr(uint(values.element(index.add(1))).shiftLeft(uint(16)));
  };
  const lanes = Array.from({ length: size }, (_, lane) => LANE_OF_BITS[scalar](laneBits(lane)));
  if (size === 1) return lanes[0];
  if (columns === undefined) return CONSTRUCT[type](...lanes);
  const columnVectors = Array.from({ length: columns }, (_, column) =>
    CONSTRUCT[`vec${columns}`](...lanes.slice(column * columns, (column + 1) * columns))
  );
  return CONSTRUCT[type](...columnVectors);
}

/** The bits of lane `lane` of `result` of `shape`, a matrix's columns one after the other. */
function laneBitsOf(result, shape, lane) {
  const { scalar, lanes: size, columns } = shape;
  const letters = ['x', 'y', 'z', 'w'];
  const components =
    size === 1
      ? [result]
      : columns === undefined
        ? letters.slice(0, size).map((letter) => result[letter])
        : Array.from(
            { length: size },
            (_, index) => result.element(int(Math.floor(index / columns)))[letters[index % columns]]
          );
  const bits = components.map((component) => BITS_OF[scalar](component));
  return bits
    .slice(1)
    .reduce((picked, component, index) => select(lane.equal(index + 1), component, picked), bits[0]);
}

/** The colour whose RGBA8 bytes are the four bytes of `bits`, low byte first, as Godot's harness writes. */
function colourOf(bits) {
  const byte = (shift) => float(bits.shiftRight(uint(shift)).bitAnd(uint(255))).div(255);
  return vec4(byte(0), byte(8), byte(16), byte(24));
}

/**
 * The bits of each result lane of `spec`'s probe over its rows, or `{ error }` when the
 * transpilation refuses the source or the GL context refuses the program.
 */
function runProbe(spec) {
  try {
    const probe = transpileShadingLanguage(spec.source).functions.get('probe');
    if (!probe) return { error: 'the transpilation has no function probe' };
    return { bits: resultBits(probe, spec) };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
}

/** The bits of each result lane of `probe` over `spec`'s rows, drawn into a one-row target. */
function resultBits(probe, spec) {
  const shapeOf = (type) => spec.shapes[type];
  const size = shapeOf(probe.returnType).lanes;
  const width = spec.rows * size;
  const pixel = int(screenCoordinate.x);
  const row = pixel.div(size);
  const lane = pixel.mod(size);
  const args = probe.arguments.map((functionArgument, index) =>
    argument(functionArgument.type, shapeOf(functionArgument.type), spec.parameters[index], row)
  );
  const material = new NodeMaterial();
  material.fragmentNode = colourOf(laneBitsOf(probe.call(args), shapeOf(probe.returnType), lane));
  quad.material = material;
  const target = new THREE.WebGLRenderTarget(width, 1, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
  });
  try {
    renderer.setRenderTarget(target);
    shaderError = undefined;
    renderer.render(scene, camera);
    if (shaderError !== undefined) throw new Error(`the GL context refuses the program: ${shaderError}`);
    const pixels = new Uint8Array(width * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, 1, pixels);
    const view = new DataView(pixels.buffer);
    return Array.from({ length: width }, (_, index) => view.getUint32(index * 4, true));
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    material.dispose();
  }
}

globalThis.runProbe = runProbe;
globalThis.pageReady = true;
