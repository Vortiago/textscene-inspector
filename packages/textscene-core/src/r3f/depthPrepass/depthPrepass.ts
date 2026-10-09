/**
 * Godot's depth prepass for the alpha-pass surfaces that use `depth_prepass_alpha`: before the
 * opaque pass, each writes depth where its alpha reaches `opaque_prepass_threshold`, and its
 * colour then blends uncut (`render_forward_clustered.cpp:1791,2088-2112`). three has no such pass,
 * so a sentinel mesh that three draws first in the opaque list draws them.
 */

import * as THREE from 'three';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/opaquePrepass';
import { opaquePrepassOf } from '../materials/opaquePrepass';
import { surfaceDepthMaterial, syncSurfaceDepth } from '../materials/surfaceDepthMaterial';

/** Below every `render_priority` (`material.h:66-67`), so three's opaque sort puts it first. */
const PREPASS_RENDER_ORDER = Number.MIN_SAFE_INTEGER;

/** The material each surface's prepass copy starts from: depth, and no colour. */
const PREPASS_BASE = new THREE.MeshDepthMaterial({ colorWrite: false });

/** Scratch for one prepass: three renders one scene at a time. */
const viewProjection = new THREE.Matrix4();
const frustum = new THREE.Frustum();

/**
 * The sentinel that draws the depth prepass of every surface in its scene before three's opaque
 * pass. It draws nothing of its own, casts nothing and takes no pick.
 */
export function createDepthPrepassSentinel(): THREE.Mesh {
  const sentinel = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })
  );
  sentinel.name = 'DepthPrepass';
  sentinel.renderOrder = PREPASS_RENDER_ORDER;
  sentinel.frustumCulled = false;
  sentinel.layers.enableAll();
  sentinel.userData = { tscnFrameExcluded: true };
  sentinel.raycast = () => {};
  sentinel.onBeforeRender = (renderer, scene, camera) => drawDepthPrepass(renderer, scene, camera);
  return sentinel;
}

/** Draws the depth prepass of every surface of `scene` that `camera` sees. */
function drawDepthPrepass(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProjection);
  scene.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.layers.test(camera.layers)) return;
    if (mesh.frustumCulled && !frustum.intersectsObject(mesh)) return;
    drawMeshPrepass(renderer, scene, camera, mesh);
  });
}

function drawMeshPrepass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  mesh: THREE.Mesh
): void {
  const { geometry, material } = mesh;
  if (!Array.isArray(material)) {
    if (drawsPrepass(material)) drawSurfacePrepass(renderer, scene, camera, mesh, material, null);
    return;
  }
  for (const group of geometry.groups) {
    const surface = material[group.materialIndex ?? 0];
    if (surface && drawsPrepass(surface)) drawSurfacePrepass(renderer, scene, camera, mesh, surface, group);
  }
}

function drawsPrepass(material: THREE.Material): boolean {
  return material.visible && opaquePrepassOf(material).drawsPrepass;
}

/**
 * One surface's prepass, between the object's own draw hooks, which pose it and skip a draw its
 * range culls, as three's colour draw does (`WebGLRenderer.js:2158-2183`).
 */
function drawSurfacePrepass(
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
  const depth = surfaceDepthMaterial(surface, PREPASS_BASE);
  syncSurfaceDepth(depth, surface, Math.max(surface.alphaTest, DEPTH_PREPASS_OPAQUE_THRESHOLD));
  depth.side = surface.side;
  // three takes a null group for a mesh of one material, typed as a group.
  renderer.renderBufferDirect(camera, scene, mesh.geometry, depth, mesh, group as THREE.GeometryGroup);
  mesh.onAfterRender(renderer, scene, camera, mesh.geometry, surface, hookGroup);
}
