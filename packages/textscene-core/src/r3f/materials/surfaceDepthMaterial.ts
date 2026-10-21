/**
 * A surface's own depth material, which cuts the surface's whole ALPHA as Godot's depth draws do:
 * the albedo alpha with the fade in it, the texture and the vertex colour
 * (`scene_forward_clustered.glsl:1251-1432`). three's depth materials read the texture alone.
 */

import * as THREE from 'three';
import {
  composeInjections,
  injectProgram,
  stateInjectionKey,
  type ProgramInjection,
} from '../materialProgramInputs';
import { pointShadowSizeInjection } from './godotPoint';
import { renderTargetMapInjection } from './renderTargetMap';

/** The material state a depth draw of a surface reads. */
type DepthSurface = THREE.Material & {
  map?: THREE.Texture | null;
  alphaMap?: THREE.Texture | null;
};

/**
 * What three's depth and distance materials share. A base that changes three's depth program
 * carries its own injection, which each copy applies first.
 */
type DepthMaterial = (THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial) & {
  readonly depthInjection?: ProgramInjection;
};

/** Seeds the alpha with `opacity` and multiplies the vertex colour in, as three's colour programs do. */
const SURFACE_ALPHA: ProgramInjection = {
  cacheKey: 'godot-surface-alpha',
  onBeforeCompile(shader) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#include <color_pars_vertex>')
      .replace('#include <begin_vertex>', '#include <color_vertex>\n#include <begin_vertex>');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n#include <color_pars_fragment>')
      .replace(
        '#include <map_fragment>',
        'diffuseColor.a = opacity;\n#include <map_fragment>\n#include <color_fragment>'
      );
  },
};

/** Each surface's depth materials, one per three material it copies. Disposed with the surface. */
const depthCopies = new WeakMap<THREE.Material, Map<DepthMaterial, DepthMaterial>>();

/**
 * The copy of three's `base` depth or distance material that draws `surface`. It keeps the base's
 * packing, and its light for a distance material.
 */
export function surfaceDepthMaterial<M extends DepthMaterial>(surface: THREE.Material, base: M): M {
  const copies = copiesOf(surface);
  let copy = copies.get(base) as M | undefined;
  if (!copy) {
    copy = base.clone() as M;
    copy.alphaHash = surface.alphaHash;
    copy.userData = surface.userData;
    injectProgram(copy, surfaceAlphaOf(copy));
    copies.set(base, copy);
  }
  return copy;
}

function copiesOf(surface: THREE.Material): Map<DepthMaterial, DepthMaterial> {
  let copies = depthCopies.get(surface);
  if (!copies) {
    const created = new Map<DepthMaterial, DepthMaterial>();
    surface.addEventListener('dispose', () => {
      for (const copy of created.values()) copy.dispose();
      depthCopies.delete(surface);
    });
    depthCopies.set(surface, created);
    copies = created;
  }
  return copies;
}

/**
 * Gives `depth` the alpha state of `surface` for one draw, cut at `alphaTest`. A change three keys
 * no program on, a slot's presence, the hash, the edge ramp or a render-target map's sampler,
 * or the size of a points surface recompiles it.
 */
export function syncSurfaceDepth(depth: DepthMaterial, surface: THREE.Material, alphaTest: number): void {
  const source = surface as DepthSurface;
  const recompiles =
    stateInjectionKey(depth) !== stateInjectionKey(surface) ||
    depth.vertexColors !== surface.vertexColors ||
    !depth.map !== !source.map ||
    !depth.alphaMap !== !source.alphaMap ||
    renderTargetMapInjection(depth.userData) !== renderTargetMapInjection(surface.userData) ||
    pointShadowSizeInjection(depth.userData) !== pointShadowSizeInjection(surface.userData);
  depth.map = source.map ?? null;
  depth.alphaMap = source.alphaMap ?? null;
  depth.opacity = surface.opacity;
  depth.vertexColors = surface.vertexColors;
  depth.alphaTest = alphaTest;
  depth.userData = surface.userData;
  depth.clippingPlanes = surface.clippingPlanes;
  depth.clipIntersection = surface.clipIntersection;
  depth.clipShadows = surface.clipShadows;
  if (!recompiles) return;
  depth.alphaHash = surface.alphaHash;
  injectProgram(depth, surfaceAlphaOf(depth));
  depth.needsUpdate = true;
}

/**
 * The depth program's own injection, the size of a points surface, the surface's alpha cut, and the
 * sampler of a render-target map that `depth.userData` records. That sample replaces the map chunk,
 * so it is last.
 */
function surfaceAlphaOf(depth: DepthMaterial): ProgramInjection | undefined {
  return composeInjections([
    depth.depthInjection,
    pointShadowSizeInjection(depth.userData),
    SURFACE_ALPHA,
    renderTargetMapInjection(depth.userData),
  ]);
}
