/**
 * One GeometryInstance3D's link to the scene cull: the node data React writes after each commit,
 * and the draw state the cull writes before each render. A drawer component and a GLB mesh, which
 * Godot imports as a MeshInstance3D, each hold one.
 */

import * as THREE from 'three';
import { geometryFade } from '../../godot/fadeAlpha';
import { hasSurface, type Aabb } from '../../godot/aabb';
import { hasVisibilityRange, NO_VISIBILITY_RANGE, type VisibilityRange } from '../../godot/visibilityRange';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import type { RangeGate } from '../surfaceDrawHooks';
import type { FadedSurface, FadedSurfaces } from '../materials/swappedMaterials';
import type { NodePlace, VisibilityInstance, VisibilityLinks } from './visibilityScene';
import { compareTreeOrder } from '../contexts/TreeOrderContext';
import { copyAabb, type InstancePlacement } from './placements';

const NODE_ORIGIN: Readonly<THREE.Vector3> = new THREE.Vector3();

/** Where an instance sits until its drawer places it: nowhere the cull can measure but the origin. */
export const UNPLACED: InstancePlacement = Object.freeze({
  nodeMatrixWorld: () => false,
  ownAabb: () => false,
});

/** Scratch for one `worldBox` or `isIndexed` call: the cull measures one instance at a time. */
const nodeMatrix = new THREE.Matrix4();
const ownBox = new THREE.Box3();
const ownSize = new THREE.Vector3();

/**
 * One instance's link to the scene cull. React writes its inputs after each commit. Before each
 * render the cull writes `isVisible`, which the draw hooks read through the `RangeGate`, and the
 * fade of each surface its drawer adds.
 */
export class CulledInstance implements VisibilityInstance, RangeGate, FadedSurfaces {
  isVisible = true;
  links: VisibilityLinks = { path: null, parentPath: null, order: [], hasRange: false };
  range: VisibilityRange = NO_VISIBILITY_RANGE;
  /** Whether its render instance has a geometry base (`godot/geometryBase.ts`). */
  hasBase = false;
  transparency = 0;
  customAabb: Aabb | null = null;
  placement = UNPLACED;
  private readonly surfaces = new Set<FadedSurface>();

  /** Takes the node's data. A change of links hands the cull a new links object. */
  update(place: NodePlace, properties: GeometryInstance3DProperties): void {
    const hasRange = hasVisibilityRange(properties.visibilityRange);
    if (!hasSameLinks(this.links, place, hasRange)) this.links = { ...place, hasRange };
    this.range = properties.visibilityRange;
    this.transparency = properties.transparency;
    this.customAabb = properties.customAabb;
  }

  /**
   * A base whose own box has a surface (`renderer_scene_cull.cpp:1675-1681`). A box not yet
   * measured counts as one, so a drawer that has not placed it keeps its links.
   */
  get isIndexed(): boolean {
    if (!this.hasBase) return false;
    if (this.customAabb) return hasSurface(this.customAabb.size);
    return !this.placement.ownAabb(ownBox) || hasSurface(ownBox.getSize(ownSize));
  }

  worldBox(target: THREE.Box3): void {
    // `custom_aabb` replaces the instance's own (`renderer_scene_cull.cpp:1988-1992`). Before
    // its geometry exists, the instance is a point at its origin.
    if (this.customAabb) copyAabb(target, this.customAabb);
    else if (!this.placement.ownAabb(target)) target.set(NODE_ORIGIN, NODE_ORIGIN);
    if (this.placement.nodeMatrixWorld(nodeMatrix)) target.applyMatrix4(nodeMatrix);
  }

  apply(isVisible: boolean, rangeFade: number): void {
    this.isVisible = isVisible;
    const fade = geometryFade(this.transparency, rangeFade);
    for (const surface of this.surfaces) surface.applyFade(fade);
  }

  add(surface: FadedSurface): () => void {
    this.surfaces.add(surface);
    return () => this.surfaces.delete(surface);
  }
}

function hasSameLinks(links: VisibilityLinks, place: NodePlace, hasRange: boolean): boolean {
  return (
    links.path === place.path &&
    links.parentPath === place.parentPath &&
    links.hasRange === hasRange &&
    compareTreeOrder(links.order, place.order) === 0
  );
}
