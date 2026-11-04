/**
 * Godot's normal-roughness prepass (`PASS_MODE_DEPTH_NORMAL_ROUGHNESS`,
 * `render_forward_clustered.cpp:1893-1905`): before the colour pass, every surface of the opaque
 * list writes its depth and its encoded view normal and roughness. Each surface draws through its own
 * program, which `prepassChunk.ts` gives the prepass's output, so its cut, its billboard and its
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
import { drawSurface, visibleSurfaces, type Surface } from '../opaqueSurfaces.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';
import { SCREEN_SPACE_STATE, screenSpaceState } from './screenSpaceState.js';
import { showBestFitNormals } from './bestFitNormals.js';
import { resolveSamples, type PrepassBuffers } from './prepassBuffers.js';

/** Scratch for one prepass: three renders one scene at a time. */
const clearColor = new THREE.Color();
const ndcOffset = new THREE.Matrix4();

/**
 * Draws the prepass of `camera`'s view of `scene` into `buffers`: each sample of the frame into its
 * own target, then the samples resolved into one frame. The caller restores the renderer's target.
 */
export function drawNormalRoughnessPrepass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  buffers: PrepassBuffers
): void {
  beginStep(renderer, 'Normal-roughness prepass');
  showBestFitNormals(renderer);
  drawSamplePrepasses(renderer, scene, camera, buffers.samplePrepasses);
  resolveSamples(renderer, buffers);
  endStep(renderer, 'Normal-roughness prepass');
}

/**
 * Draws the prepass of each sample of the frame into its target of `prepasses`, through `camera`
 * moved so each pixel's centre lands on the sample's standard location. A surface's normal and
 * roughness are those at the sample, where a multisampled draw of Godot's reads them at the
 * pixel's centre: one value across a flat face. The jitter stays under a pixel, so every sample
 * draws the surfaces `camera` sees.
 */
function drawSamplePrepasses(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  prepasses: readonly THREE.WebGLRenderTarget[]
): void {
  const surfaces = visibleSurfaces(scene, camera, isInOpaqueList);
  if (prepasses.length === 1) {
    drawNormalRoughness(renderer, scene, camera, surfaces, prepasses[0]!);
    return;
  }
  const locations = standardSampleLocations(prepasses.length);
  prepasses.forEach((prepass, i) => {
    const jitter = sampleJitter(locations[i]!, prepass.width, prepass.height);
    drawNormalRoughness(renderer, scene, jitteredCamera(camera, jitter, i), surfaces, prepass);
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
 * Draws the prepass of `surfaces` into `target`, cleared first to Godot's clear of zero and the
 * far plane (`render_forward_clustered.cpp:1916`).
 */
function drawNormalRoughness(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  surfaces: readonly Surface[],
  target: THREE.WebGLRenderTarget
): void {
  renderer.setRenderTarget(target);
  clearToZero(renderer);
  screenSpaceState[SCREEN_SPACE_STATE.drawsNormalRoughness] = 1;
  try {
    for (const surface of surfaces) drawPrepassSurface(renderer, scene, camera, surface);
  } finally {
    screenSpaceState[SCREEN_SPACE_STATE.drawsNormalRoughness] = 0;
  }
}

function clearToZero(renderer: THREE.WebGLRenderer): void {
  renderer.getClearColor(clearColor);
  const clearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, false);
  renderer.setClearColor(clearColor, clearAlpha);
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

/** One surface's prepass through its own program. A surface of the alpha pass writes unblended and cut. */
function drawPrepassSurface(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  surface: Surface
): void {
  const { material } = surface;
  const { blending, depthWrite } = material;
  if (material.transparent) {
    material.blending = THREE.NoBlending;
    material.depthWrite = true;
    screenSpaceState[SCREEN_SPACE_STATE.prepassCut] = Math.max(
      material.alphaTest,
      DEPTH_PREPASS_OPAQUE_THRESHOLD
    );
  }
  try {
    drawSurface(renderer, scene, camera, surface, material);
  } finally {
    material.blending = blending;
    material.depthWrite = depthWrite;
    screenSpaceState[SCREEN_SPACE_STATE.prepassCut] = 0;
  }
}
