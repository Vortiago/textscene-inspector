/**
 * Godot's depth prepass for the alpha-pass surfaces that use `depth_prepass_alpha`: before the
 * opaque pass, each writes depth where its alpha reaches `opaque_prepass_threshold`, and its
 * colour then blends uncut (`render_forward_clustered.cpp:1791,2088-2112`). three has no such pass,
 * so a sentinel mesh that three draws first in the opaque list draws them.
 */

import * as THREE from 'three';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/rendering/opaquePrepass';
import { opaquePrepassOf } from '../materials/opaquePrepass';
import { surfaceDepthMaterial, syncSurfaceDepth } from '../materials/surfaceDepthMaterial';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { drawSurface, visibleSurfaces } from '../opaqueSurfaces';
import { createFirstOpaqueSentinel } from '../opaqueSentinel';

/** The material each surface's prepass copy starts from: depth, and no colour. */
const PREPASS_BASE = new THREE.MeshDepthMaterial({ colorWrite: false });

/** The sentinel that draws the depth prepass of every surface in its scene before three's opaque pass. */
export function createDepthPrepassSentinel(): THREE.Mesh {
  return createFirstOpaqueSentinel('DepthPrepass', drawDepthPrepass);
}

/** Draws the depth prepass of every surface of `scene` that `camera` sees. */
function drawDepthPrepass(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  beginStep(renderer, 'Depth prepass');
  for (const surface of visibleSurfaces(scene, camera, drawsPrepass)) {
    drawSurface(renderer, scene, camera, surface, prepassMaterialOf(surface.material));
  }
  endStep(renderer, 'Depth prepass');
}

function drawsPrepass(material: THREE.Material): boolean {
  return material.visible && opaquePrepassOf(material).drawsPrepass;
}

/** The surface's depth copy, cut at its prepass threshold. */
function prepassMaterialOf(surface: THREE.Material): THREE.Material {
  const depth = surfaceDepthMaterial(surface, PREPASS_BASE);
  syncSurfaceDepth(depth, surface, Math.max(surface.alphaTest, DEPTH_PREPASS_OPAQUE_THRESHOLD));
  depth.side = surface.side;
  return depth;
}
