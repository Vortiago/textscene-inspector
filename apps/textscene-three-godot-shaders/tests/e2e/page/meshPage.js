import * as THREE from 'three';
import { transpileSpatial, withGodotAttributes, writeSpatialBindings } from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, euler, godotCamera, linear } from './godotView.js';

/** `rendering/environment/defaults/default_clear_color`. */
const GODOT_CLEAR_COLOR = linear([0.3, 0.3, 0.3]);

/** Each corner of each triangle in three's order: three's front face winds the other way. */
const turnedCorner = (corner) => corner - (corner % 3) + [0, 2, 1][corner % 3];

/** Each of Godot's arrays a mesh may hold, by its three attribute and its lanes. */
const ARRAYS = [
  ['positions', 'position', 3],
  ['normals', 'normal', 3],
  ['tangents', 'tangent', 4],
  ['uvs', 'uv', 2],
  ['uv2s', 'uv1', 2],
  ['colors', 'color', 4],
];

/** Godot's arrays as three's geometry, each triangle turned. */
function geometryOf(mesh) {
  const geometry = new THREE.BufferGeometry();
  for (const [array, attribute, lanes] of ARRAYS) {
    const values = mesh[array];
    if (!values) continue;
    const turned = values.flatMap((_, corner) => values[turnedCorner(corner)]);
    geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(turned, lanes));
  }
  return withGodotAttributes(geometry);
}

/** `node` placed by a spec's position, rotation in degrees and scale. */
function placed(node, { position, rotation, scale }) {
  node.position.fromArray(position);
  node.rotation.copy(euler(rotation));
  node.scale.fromArray(scale);
  return node;
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
  const camera = godotCamera(spec);
  const mesh = placed(new THREE.Mesh(geometryOf(spec.mesh), spatial.material), spec.object);
  mesh.frustumCulled = false;
  writeSpatialBindings(spatial, { camera, width, height, time: 0, clearColor: GODOT_CLEAR_COLOR });
  const scene = new THREE.Scene();
  scene.add(spec.parent ? placed(new THREE.Group(), spec.parent).add(mesh) : mesh);
  displayRenderer.setClearColor(GODOT_CLEAR_COLOR, 1);
  const pixels = framePixels(displayRenderer, scene, camera, {
    width,
    height,
    colorSpace: THREE.SRGBColorSpace,
  });
  spatial.material.dispose();
  mesh.geometry.dispose();
  return { pixels: Array.from(pixels) };
}

globalThis.drawMesh = drawMesh;
