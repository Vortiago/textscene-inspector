import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';

/** The two texels' bytes, high then low: the depths 255 and 256. */
const PROBE_TEXELS = new Uint8Array([0, 255, 1, 0]);

const PROBE_FRAGMENT = /* glsl */ `
uniform sampler2D probe;
out vec4 fragColour;
void main() {
	vec2 bytes = textureLod( probe, vec2( 0.5 ), 0.0 ).rg * 255.0;
	fragColour = vec4( fract( dot( bytes, vec2( 256.0, 1.0 ) ) ), 0.0, 0.0, 1.0 );
}`;

const PROBE_VERTEX = /* glsl */ `
void main() {
	gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

/** Halfway between the depths 255 and 256: full precision gives 0.5, stored as 128; an 8-bit filter 0. */
const FULL_PRECISION_BYTE = 128;
const TOLERANCE_BYTES = 16;

/** Whether the probe's read-back byte shows a full-precision filter. */
export function isFullPrecisionByte(byte: number): boolean {
  return Math.abs(byte - FULL_PRECISION_BYTE) <= TOLERANCE_BYTES;
}

/** Whether the GPU's linear filter mixes two texels' byte pairs into their depths' mix, once per renderer. */
export const filtersTwoBytesExactly = perObject((renderer: THREE.WebGLRenderer) =>
  isFullPrecisionByte(probeByte(renderer))
);

function probeByte(renderer: THREE.WebGLRenderer): number {
  const texels = new THREE.DataTexture(PROBE_TEXELS, 2, 1, THREE.RGFormat, THREE.UnsignedByteType);
  texels.minFilter = THREE.LinearFilter;
  texels.magFilter = THREE.LinearFilter;
  texels.needsUpdate = true;
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `in vec3 position;\n${PROBE_VERTEX}`,
    fragmentShader: `precision highp float;\n${PROBE_FRAGMENT}`,
    uniforms: { probe: { value: texels } },
  });
  const triangle = new THREE.BufferGeometry();
  triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const scene = new THREE.Scene().add(new THREE.Mesh(triangle, material));
  const target = new THREE.WebGLRenderTarget(1, 1);
  const pixel = new Uint8Array(4);
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, new THREE.Camera());
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
    triangle.dispose();
    material.dispose();
    texels.dispose();
  }
  return pixel[0]!;
}
