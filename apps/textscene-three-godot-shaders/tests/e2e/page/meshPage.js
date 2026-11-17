import * as THREE from 'three';
import {
  installNodesHandler,
  transpileSpatial,
  withGodotAttributes,
  writeSpatialBindings,
  writeSpatialInstance,
} from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'display');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

/** Godot's rotation in degrees, in Godot's order of axes: Y, then X, then Z. */
const euler = ([x, y, z]) => new THREE.Euler(...[x, y, z].map(THREE.MathUtils.degToRad), 'YXZ');

/** `rendering/environment/defaults/default_clear_color`, sRGB. */
const GODOT_CLEAR_COLOR = new THREE.Color().setRGB(0.3, 0.3, 0.3, THREE.SRGBColorSpace);

/** Godot's arrays as three's geometry: three's front face winds the other way, so each triangle turns. */
function geometryOf({ positions, normals }) {
  const order = positions.flatMap(
    (_, corner) => [corner - (corner % 3), corner - (corner % 3) + 2, corner - (corner % 3) + 1][corner % 3]
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      order.flatMap((index) => positions[index]),
      3
    )
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      order.flatMap((index) => normals[index]),
      3
    )
  );
  return withGodotAttributes(geometry);
}

/** The pixels of `spec`'s mesh, or `{ error }` when the transpilation refuses it. */
function drawMesh(spec) {
  let spatial;
  try {
    spatial = transpileSpatial(spec.source);
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
  const { width, height } = spec;
  // Godot's defaults: the near and far planes of Camera3D.
  const camera = new THREE.PerspectiveCamera(spec.camera.fov, width / height, 0.05, 4000);
  camera.rotation.copy(euler(spec.camera.rotation));
  camera.position.fromArray(spec.camera.position);
  camera.updateMatrixWorld();
  const mesh = new THREE.Mesh(geometryOf(spec.mesh), spatial.material);
  mesh.position.fromArray(spec.object.position);
  mesh.rotation.copy(euler(spec.object.rotation));
  mesh.scale.fromArray(spec.object.scale);
  mesh.frustumCulled = false;
  writeSpatialBindings(spatial, { camera, width, height, time: 0, clearColor: GODOT_CLEAR_COLOR });
  writeSpatialInstance(spatial, mesh);
  const scene = new THREE.Scene();
  scene.add(mesh);
  renderer.setClearColor(GODOT_CLEAR_COLOR, 1);
  const pixels = framePixels(renderer, scene, camera, { width, height, colorSpace: THREE.SRGBColorSpace });
  spatial.material.dispose();
  return { pixels: Array.from(pixels) };
}

globalThis.drawMesh = drawMesh;
