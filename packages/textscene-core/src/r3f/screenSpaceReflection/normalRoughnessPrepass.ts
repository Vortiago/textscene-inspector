/**
 * Godot's normal-roughness prepass (`PASS_MODE_DEPTH_NORMAL_ROUGHNESS`,
 * `render_forward_clustered.cpp:1893-1905`): before the colour pass, every surface of the opaque
 * list writes its depth and its encoded view normal and roughness. Each surface draws through its own
 * program, which `ssrSceneChunk.ts` gives the prepass's output, so its cut, its billboard and its
 * skin place it as its colour draw does.
 */

import * as THREE from 'three';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/rendering/opaquePrepass.js';
import { opaquePrepassOf } from '../materials/opaquePrepass.js';
import {
  sampleJitter,
  standardSampleLocations,
  type SampleLocation,
} from '../../godot/rendering/msaaSampleLocations.js';
import { perObject } from '../../utils/perObject.js';
import { cameraFrustum } from '../cameraFrustum.js';
import { SSR_STATE, ssrState } from './ssrUniforms.js';

/** Scratch for one prepass: three renders one scene at a time. */
const frustum = new THREE.Frustum();
const clearColor = new THREE.Color();
const ndcOffset = new THREE.Matrix4();

/**
 * Draws the prepass of each sample of the frame into its target of `prepasses`, through `camera`
 * moved so each pixel's centre lands on the sample's standard location. A surface's normal and
 * roughness are those at the sample, where a multisampled draw of Godot's reads them at the
 * pixel's centre: one value across a flat face.
 */
export function drawSamplePrepasses(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  prepasses: readonly THREE.WebGLRenderTarget[]
): void {
  if (prepasses.length === 1) {
    drawNormalRoughness(renderer, scene, camera, prepasses[0]!);
    return;
  }
  const locations = standardSampleLocations(prepasses.length);
  prepasses.forEach((prepass, i) => {
    const jitter = sampleJitter(locations[i]!, prepass.width, prepass.height);
    drawNormalRoughness(renderer, scene, jitteredCamera(camera, jitter, i), prepass);
  });
}

/**
 * Written only by `jitteredCamera`: per camera, one stand-in per sample. Each stand-in inherits the
 * camera and owns its projection, and three uploads a projection only for a camera it has not drawn
 * through since its last program change (`WebGLRenderer.js` `setProgram`), so each sample needs its own.
 */
const standInsOf = perObject((_camera: THREE.Camera) => new Map<number, THREE.Camera>());

function jitteredCamera(camera: THREE.Camera, jitter: SampleLocation, sample: number): THREE.Camera {
  const standIns = standInsOf(camera);
  let standIn = standIns.get(sample);
  if (!standIn) {
    standIn = Object.create(camera) as THREE.Camera;
    standIn.projectionMatrix = new THREE.Matrix4();
    standIns.set(sample, standIn);
  }
  // A translation by the jitter in clip space adds it to every point's NDC.
  ndcOffset.makeTranslation(jitter.x, jitter.y, 0);
  standIn.projectionMatrix.multiplyMatrices(ndcOffset, camera.projectionMatrix);
  return standIn;
}

/**
 * Draws the prepass of every surface of `scene` that `camera` sees into `target`, cleared first to
 * Godot's clear of zero and the far plane (`render_forward_clustered.cpp:1916`).
 */
function drawNormalRoughness(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget
): void {
  renderer.setRenderTarget(target);
  clearToZero(renderer);
  cameraFrustum(camera, frustum);
  ssrState[SSR_STATE.drawsNormalRoughness] = 1;
  try {
    scene.traverseVisible((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.layers.test(camera.layers)) return;
      if (mesh.frustumCulled && !frustum.intersectsObject(mesh)) return;
      drawMesh(renderer, scene, camera, mesh);
    });
  } finally {
    ssrState[SSR_STATE.drawsNormalRoughness] = 0;
    ssrState[SSR_STATE.prepassCut] = 0;
  }
}

function clearToZero(renderer: THREE.WebGLRenderer): void {
  renderer.getClearColor(clearColor);
  const clearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, false);
  renderer.setClearColor(clearColor, clearAlpha);
}

function drawMesh(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  mesh: THREE.Mesh
): void {
  const { geometry, material } = mesh;
  if (!Array.isArray(material)) {
    if (isInOpaqueList(material)) drawSurface(renderer, scene, camera, mesh, material, null);
    return;
  }
  for (const group of geometry.groups) {
    const surface = material[group.materialIndex ?? 0];
    if (surface && isInOpaqueList(surface)) drawSurface(renderer, scene, camera, mesh, surface, group);
  }
}

/**
 * An opaque surface, or one of the alpha pass whose depth the prepass draws. Every surface of a
 * Godot node draws with a basic, standard or physical material. Any other is the previewer's own.
 */
function isInOpaqueList(material: THREE.Material): boolean {
  if (!material.visible || !material.colorWrite || !writesNormalRoughness(material)) return false;
  return !material.transparent || opaquePrepassOf(material).drawsPrepass;
}

function writesNormalRoughness(material: THREE.Material): boolean {
  const { isMeshBasicMaterial, isMeshStandardMaterial } = material as Partial<
    THREE.MeshBasicMaterial & THREE.MeshStandardMaterial
  >;
  return isMeshBasicMaterial === true || isMeshStandardMaterial === true;
}

/**
 * One surface's prepass, between the object's own draw hooks, as three's colour draw runs them
 * (`WebGLRenderer.js:2158-2183`). A surface of the alpha pass writes unblended and cut.
 */
function drawSurface(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  mesh: THREE.Mesh,
  surface: THREE.Material,
  group: THREE.GeometryGroup | null
): void {
  const hookGroup = group as unknown as THREE.Group;
  mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, surface, hookGroup);
  mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
  mesh.normalMatrix.getNormalMatrix(mesh.modelViewMatrix);
  const { blending, depthWrite } = surface;
  if (surface.transparent) {
    surface.blending = THREE.NoBlending;
    surface.depthWrite = true;
    ssrState[SSR_STATE.prepassCut] = Math.max(surface.alphaTest, DEPTH_PREPASS_OPAQUE_THRESHOLD);
  }
  try {
    // three takes a null group for a mesh of one material, typed as a group.
    renderer.renderBufferDirect(camera, scene, mesh.geometry, surface, mesh, group as THREE.GeometryGroup);
  } finally {
    surface.blending = blending;
    surface.depthWrite = depthWrite;
    ssrState[SSR_STATE.prepassCut] = 0;
  }
  mesh.onAfterRender(renderer, scene, camera, mesh.geometry, surface, hookGroup);
}
