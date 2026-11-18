import * as THREE from 'three';
import { glslFn } from 'three/tsl';
import { transpileSpatial, withGodotAttributes, writeSpatialBindings } from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, euler, godotCamera, linear, shaderTime } from './godotView.js';

/** A fragment whose GLSL reads a name it never declares, which every driver refuses. */
const BROKEN_FRAGMENT = glslFn('vec4 brokenFragment() { return undeclared_in_glsl; }');

/** `rendering/environment/defaults/default_clear_color`. */
const GODOT_CLEAR_COLOR = linear([0.3, 0.3, 0.3]);

/** Each corner of each triangle in three's order: three's front face winds the other way. */
const counterClockwiseCorner = (corner) => corner - (corner % 3) + [0, 2, 1][corner % 3];

/** Each of Godot's arrays a mesh may hold, by its three attribute and its lanes. */
const ARRAYS = [
  ['positions', 'position', 3],
  ['normals', 'normal', 3],
  ['tangents', 'tangent', 4],
  ['uvs', 'uv', 2],
  ['uv2s', 'uv1', 2],
  ['colors', 'color', 4],
  ['custom0s', 'custom0', 4],
  ['custom1s', 'custom1', 4],
  ['custom2s', 'custom2', 4],
  ['custom3s', 'custom3', 4],
  ['bones', 'skinIndex', 4],
  ['weights', 'skinWeight', 4],
];

/** Godot's arrays as three's geometry in Godot's vertex order, its index counter-clockwise. */
function geometryOf(mesh) {
  const geometry = new THREE.BufferGeometry();
  for (const [array, attribute, lanes] of ARRAYS) {
    const values = mesh[array];
    if (values) geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(values.flat(), lanes));
  }
  geometry.setIndex(mesh.positions.map((_, corner) => counterClockwiseCorner(corner)));
  return withGodotAttributes(geometry);
}

/** `node` placed by a spec's position, rotation in degrees and scale. */
function placed(node, { position, rotation, scale }) {
  node.position.fromArray(position);
  node.rotation.copy(euler(rotation));
  node.scale.fromArray(scale);
  return node;
}

/** The transpiled shader of each source, one for each source, so objects of one source share it. */
function transpiledBySource(spec) {
  const sources = new Set([spec.source, ...(spec.others ?? []).map(({ source }) => source ?? spec.source)]);
  return new Map([...sources].map((source) => [source, transpileSpatial(source)]));
}

/** The pixels of the meshes, `{ error }` for a refused text, or `{ faults }` for a refused program. */
function drawMesh(spec) {
  let transpiled;
  try {
    transpiled = transpiledBySource(spec);
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
  const { width, height } = spec;
  const camera = godotCamera(spec);
  for (const spatial of transpiled.values())
    writeSpatialBindings(spatial, {
      camera,
      width,
      height,
      time: shaderTime(spec.clock),
      clearColor: GODOT_CLEAR_COLOR,
    });
  const geometry = geometryOf(spec.mesh);
  const objects = [{ object: spec.object, source: spec.source }, ...(spec.others ?? [])];
  const meshes = objects.map(({ object, source = spec.source }, order) => {
    const { material } = transpiled.get(source);
    const mesh = placed(new THREE.Mesh(geometry, material), object);
    mesh.frustumCulled = false;
    // The alpha pass sorts by depth, as Godot's does (`render_forward_clustered.cpp:955`).
    mesh.renderOrder = material.transparent ? 0 : order;
    return mesh;
  });
  const scene = new THREE.Scene();
  scene.add(
    spec.parent ? placed(new THREE.Group(), spec.parent).add(...meshes) : new THREE.Group().add(...meshes)
  );
  displayRenderer.setClearColor(GODOT_CLEAR_COLOR, 1);
  const faults = [];
  for (const spatial of transpiled.values())
    spatial.material.onTranslatorFault = (fault) => faults.push(fault);
  if (spec.breaksFragment)
    for (const spatial of transpiled.values()) spatial.material.fragmentNode = BROKEN_FRAGMENT();
  const pixels = framePixels(displayRenderer, scene, camera, {
    width,
    height,
    colorSpace: THREE.SRGBColorSpace,
    samples: spec.msaa ?? 0,
  });
  for (const spatial of transpiled.values()) spatial.material.dispose();
  geometry.dispose();
  if (faults.length > 0) return { faults: faults.map(({ name, message, log }) => ({ name, message, log })) };
  return { pixels: Array.from(pixels) };
}

globalThis.drawMesh = drawMesh;
