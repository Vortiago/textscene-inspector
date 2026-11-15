import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import { screenCoordinate, screenSize, vec4 } from 'three/tsl';
import { installNodesHandler, transpileShadingLanguage } from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'linear');
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

/** Godot's ColorRect UV and three's screen coordinate both start at the top left, at the pixel centre. */
const uv = screenCoordinate.div(screenSize);

/** The pixels of `showcase`'s function, or `{ error }` when the transpilation refuses it. */
function drawShowcase(showcase) {
  let pattern;
  try {
    pattern = transpileShadingLanguage(showcase.source).functions.get('pattern');
    if (!pattern) return { error: 'the transpilation has no function pattern' };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
  const material = new NodeMaterial();
  material.fragmentNode = vec4(pattern.call([uv]), 1);
  quad.material = material;
  const pixels = framePixels(renderer, scene, camera, showcase);
  material.dispose();
  return { pixels: Array.from(pixels) };
}

globalThis.drawShowcase = drawShowcase;
