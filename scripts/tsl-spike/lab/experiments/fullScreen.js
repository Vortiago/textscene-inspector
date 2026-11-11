/**
 * A full-screen node material under the handler, beside a `ShaderMaterial` that does the same work:
 * each copies a half-float target to the canvas at an exposure. The target's picture has no
 * symmetry, so a pass that turns it over shows.
 */

import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { texture, uniform, uv, vec4 } from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import { copyPixels, flippedRows, imageDelta } from '../pixels.js';

const EXPOSURE = 0.8;

function drawPicture(renderer, target) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.1, 0.2, 0.4);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());
  box.position.set(-1.2, 0.9, 0);
  box.rotation.set(0.5, 0.6, 0);
  scene.add(box);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
  camera.position.z = 5;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
}

function classicCopy(source) {
  return new THREE.ShaderMaterial({
    uniforms: { source: { value: source }, exposure: { value: EXPOSURE } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader:
      'uniform sampler2D source; uniform float exposure; varying vec2 vUv;' +
      'void main() { gl_FragColor = vec4( texture2D( source, vUv ).rgb * exposure, 1.0 ); }',
  });
}

function nodeCopy(source, coord) {
  const material = new NodeMaterial();
  material.fragmentNode = vec4(texture(source, coord).rgb.mul(uniform(EXPOSURE)), 1);
  return material;
}

function drawn(renderer, material) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  return copyPixels(renderer.domElement);
}

export function run(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const handler = new WebGLNodesHandler();
  // The copy writes display values itself, as the classic material does.
  handler.getOutputCallback = (output) => output;
  renderer.setNodesHandler(handler);
  const target = new THREE.WebGLRenderTarget(canvas.width, canvas.height, { type: THREE.HalfFloatType });
  drawPicture(renderer, target);

  const classic = drawn(renderer, classicCopy(target.texture));
  const node = drawn(renderer, nodeCopy(target.texture, uv()));
  const nodeTurnedBack = drawn(renderer, nodeCopy(target.texture, uv().flipY()));
  return {
    nodeAgainstClassic: imageDelta(classic, node),
    nodeAgainstClassicTurnedOver: imageDelta(flippedRows(classic), node),
    nodeTurnedBackAgainstClassic: imageDelta(classic, nodeTurnedBack),
  };
}
