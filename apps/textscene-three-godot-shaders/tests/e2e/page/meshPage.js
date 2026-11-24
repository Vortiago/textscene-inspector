import * as THREE from 'three';
import { glslFn } from 'three/tsl';
import {
  createDepthPrepass,
  emulatedPointGeometry,
  specialiseSpatial,
  transpileSpatial,
  withGodotAttributes,
  writeSpatialBindings,
} from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, euler, godotCamera, linear, shaderTime } from './godotView.js';

/** A fragment whose GLSL reads a name it never declares, which every driver refuses. */
const BROKEN_FRAGMENT = glslFn('vec4 brokenFragment() { return undeclared_in_glsl; }');

/** `rendering/environment/defaults/default_clear_color`. */
const GODOT_CLEAR_COLOR = linear([0.3, 0.3, 0.3]);

/** Godot's defaults of the Environment's fog properties (`scene/resources/environment.h:181-197`). */
const FOG_DEFAULTS = {
  fog_mode: 0,
  fog_light_color: [0.518, 0.553, 0.608],
  fog_light_energy: 1,
  fog_sun_scatter: 0,
  fog_density: 0.01,
  fog_height: 0,
  fog_height_density: 0,
  fog_aerial_perspective: 0,
  fog_sky_affect: 1,
  fog_depth_curve: 1,
  fog_depth_begin: 10,
  fog_depth_end: 100,
};

/** The density `set_fog_mode` sets as `mode` turns into `next` (`environment.cpp:778-783`). */
const fogModeDensity = (mode, next) => (mode !== next && next === 0 ? 0.01 : 1);

/** The environment's fog from a scene's Godot `fog_*` properties, or nothing when it has none. */
function environmentFog(properties) {
  if (!properties) return undefined;
  const fog = { ...FOG_DEFAULTS };
  // In the order `fogged_world` sets them: a density before `fog_mode` gives way to its reset.
  for (const [property, value] of Object.entries(properties)) {
    if (property === 'fog_mode') fog.fog_density = fogModeDensity(fog.fog_mode, value);
    fog[property] = value;
  }
  return {
    lightColor: linear(fog.fog_light_color),
    lightEnergy: fog.fog_light_energy,
    mode: fog.fog_mode,
    density: fog.fog_density,
    height: fog.fog_height,
    heightDensity: fog.fog_height_density,
    depthCurve: fog.fog_depth_curve,
    depthBegin: fog.fog_depth_begin,
    depthEnd: fog.fog_depth_end,
    sunScatter: fog.fog_sun_scatter,
    skyAffect: fog.fog_sky_affect,
    aerialPerspective: fog.fog_aerial_perspective,
  };
}

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

/** Godot's arrays as three's geometry in Godot's vertex order, a triangle's index counter-clockwise. */
function geometryOf(mesh, primitive) {
  const geometry = new THREE.BufferGeometry();
  for (const [array, attribute, lanes] of ARRAYS) {
    const values = mesh[array];
    if (values) geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(values.flat(), lanes));
  }
  const indices = mesh.indices ?? mesh.positions.map((_, corner) => corner);
  if (primitive === 'triangles')
    geometry.setIndex(indices.map((_, corner) => indices[counterClockwiseCorner(corner)]));
  return withGodotAttributes(geometry, primitive);
}

/** The three object that draws `geometry` as Godot draws its surface with `spatial`. */
function drawnObject(geometry, primitive, spatial) {
  if (spatial.pointDraw === 'emulated')
    return new THREE.Mesh(emulatedPointGeometry(geometry), spatial.material);
  if (spatial.pointDraw === 'native' || primitive === 'points')
    return new THREE.Points(geometry, spatial.material);
  if (primitive === 'lines') return new THREE.LineSegments(geometry, spatial.material);
  return new THREE.Mesh(geometry, spatial.material);
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
  const options = { renderingMethod: spec.renderingMethod ?? 'forward_plus' };
  return new Map([...sources].map((source) => [source, transpileSpatial(source, options)]));
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
  const fog = environmentFog(spec.fog);
  for (const spatial of transpiled.values()) {
    writeSpatialBindings(spatial, {
      camera,
      width,
      height,
      time: shaderTime(spec.clock),
      clearColor: GODOT_CLEAR_COLOR,
      fog,
    });
    specialiseSpatial(spatial, fog);
  }
  const primitive = spec.primitive ?? 'triangles';
  const geometry = geometryOf(spec.mesh, primitive);
  const objects = [{ object: spec.object, source: spec.source }, ...(spec.others ?? [])];
  const meshes = objects.map(({ object, source = spec.source }, order) => {
    const spatial = transpiled.get(source);
    const { material } = spatial;
    const mesh = placed(drawnObject(geometry, primitive, spatial), object);
    mesh.frustumCulled = false;
    // The alpha pass sorts by depth, as Godot's does (`render_forward_clustered.cpp:955`).
    mesh.renderOrder = material.transparent ? 0 : order;
    return mesh;
  });
  const prepass = createDepthPrepass({
    renderingMethod: spec.renderingMethod ?? 'forward_plus',
    isEnabled: spec.depthPrepass,
  });
  const scene = new THREE.Scene();
  scene.add(
    spec.parent ? placed(new THREE.Group(), spec.parent).add(...meshes) : new THREE.Group().add(...meshes),
    prepass.first,
    prepass.last
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
  prepass.dispose();
  for (const drawn of new Set([geometry, ...meshes.map((mesh) => mesh.geometry)])) drawn.dispose();
  if (faults.length > 0) return { faults: faults.map(({ name, message, log }) => ({ name, message, log })) };
  return { pixels: Array.from(pixels) };
}

globalThis.drawMesh = drawMesh;
