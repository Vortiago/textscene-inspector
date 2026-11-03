/**
 * The browser side of the sky coordinates gate: draws one pixel for each eye direction through
 * `GODOT_SKY_COORDS_GLSL` into a float target, and reads the coordinates back.
 */
import * as THREE from 'three';
import { GODOT_SKY_COORDS_GLSL } from '../../packages/textscene-core/src/godot/rendering/environment/skyCoords.ts';
import { SKY_COORDS_CASES } from './skyCoordsChecks.mjs';

/* global window, document */
// `window` and `document` exist only in the browser that loads this page.

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });

const material = new THREE.ShaderMaterial({
  uniforms: {
    directions: { value: SKY_COORDS_CASES.map(({ direction }) => new THREE.Vector3(...direction)) },
  },
  vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */ `
uniform vec3 directions[${SKY_COORDS_CASES.length}];
${GODOT_SKY_COORDS_GLSL}
void main() {
  gl_FragColor = vec4(godotSkyCoords(normalize(directions[int(gl_FragCoord.x)])), 0.0, 1.0);
}`,
});

/** The (u, v) of each case's direction, in the order of `SKY_COORDS_CASES`. */
function evaluate() {
  const width = SKY_COORDS_CASES.length;
  const target = new THREE.WebGLRenderTarget(width, 1, { type: THREE.FloatType });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  renderer.setRenderTarget(target);
  renderer.render(scene, new THREE.Camera());
  const pixels = new Float32Array(width * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, 1, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  return SKY_COORDS_CASES.map((_, index) => [pixels[index * 4], pixels[index * 4 + 1]]);
}

window.skyCoordsSamples = evaluate;
