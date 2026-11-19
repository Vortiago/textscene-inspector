import * as THREE from 'three';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/rendering/opaquePrepass';
import { opaquePrepassOf } from '../materials/opaquePrepass';
import { surfaceDepthMaterial, syncSurfaceDepth } from '../materials/surfaceDepthMaterial';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import {
  createDepthPrepass,
  ownProgramDraw,
  type DepthPrepass,
  type DepthPrepassOptions,
  type PrepassDraw,
} from '../../shaders/pipeline/depthPrepass';

/** The material each alpha-pass surface's prepass copy starts from: depth, and no colour. */
const PREPASS_BASE = new THREE.MeshDepthMaterial({ colorWrite: false });

/** The project renderer's prepass of a scene, timed as the frame profile's "Depth prepass" step. */
export function createSceneDepthPrepass(
  options: Pick<DepthPrepassOptions, 'renderingMethod' | 'isEnabled' | 'disabledVendors'> = {}
): DepthPrepass {
  return createDepthPrepass({ ...options, unset: previewerDraw, timed });
}

function timed(renderer: THREE.WebGLRenderer, draw: () => void): void {
  beginStep(renderer, 'Depth prepass');
  draw();
  endStep(renderer, 'Depth prepass');
}

/** A cut surface draws its depth copy, as Godot draws its own program cut at the threshold. */
function previewerDraw(material: THREE.Material): PrepassDraw | null {
  if (opaquePrepassOf(material).drawsPrepass) return { material: alphaPrepassMaterialOf(material) };
  return ownProgramDraw(material);
}

/** The surface's depth copy, cut at its prepass threshold. */
function alphaPrepassMaterialOf(surface: THREE.Material): THREE.Material {
  const depth = surfaceDepthMaterial(surface, PREPASS_BASE);
  syncSurfaceDepth(depth, surface, Math.max(surface.alphaTest, DEPTH_PREPASS_OPAQUE_THRESHOLD));
  depth.side = surface.side;
  return depth;
}
