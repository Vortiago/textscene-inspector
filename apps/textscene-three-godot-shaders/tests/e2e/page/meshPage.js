import * as THREE from 'three';
import {
  transpileSpatial,
  withGodotAttributes,
  writeSpatialBindings,
  writeSpatialInstance,
} from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, euler, godotCamera, linear } from './godotView.js';

/** `rendering/environment/defaults/default_clear_color`. */
const GODOT_CLEAR_COLOR = linear([0.3, 0.3, 0.3]);

/** Each corner of each triangle in three's order: three's front face winds the other way. */
const turnedCorner = (corner) => corner - (corner % 3) + [0, 2, 1][corner % 3];

/** Godot's arrays as three's geometry, each triangle turned. */
function geometryOf({ positions, normals }) {
  const turned = (values) =>
    new THREE.Float32BufferAttribute(
      values.flatMap((_, corner) => values[turnedCorner(corner)]),
      3
    );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', turned(positions));
  geometry.setAttribute('normal', turned(normals));
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
  const camera = godotCamera(spec);
  const mesh = new THREE.Mesh(geometryOf(spec.mesh), spatial.material);
  mesh.position.fromArray(spec.object.position);
  mesh.rotation.copy(euler(spec.object.rotation));
  mesh.scale.fromArray(spec.object.scale);
  mesh.frustumCulled = false;
  writeSpatialBindings(spatial, { camera, width, height, time: 0, clearColor: GODOT_CLEAR_COLOR });
  writeSpatialInstance(spatial, mesh);
  const scene = new THREE.Scene();
  scene.add(mesh);
  displayRenderer.setClearColor(GODOT_CLEAR_COLOR, 1);
  const pixels = framePixels(displayRenderer, scene, camera, {
    width,
    height,
    colorSpace: THREE.SRGBColorSpace,
  });
  spatial.material.dispose();
  return { pixels: Array.from(pixels) };
}

globalThis.drawMesh = drawMesh;
