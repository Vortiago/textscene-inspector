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
import type { DrawnInstance } from '../surfaceDrawHooks';
import type { FadedSurface, FadedSurfaces } from '../materials/swappedMaterials';
import type { NodePlace, VisibilityInstance, VisibilityLinks } from './visibilityScene';
import { compareTreeOrder } from '../contexts/TreeOrderContext';
import { copyAabb, UNPLACED } from './placements';

/** Scratch for one `isPlaced`, `worldBox` or `isIndexed` call: the cull measures one instance at a time. */
const nodeMatrix = new THREE.Matrix4();
const ownBox = new THREE.Box3();
const ownSize = new THREE.Vector3();

/**
 * One instance's link to the scene cull. React writes its inputs after each commit. Before each
 * render the cull writes `isVisible`, which the draw hooks read through `DrawnInstance`, and the
 * fade of each surface its drawer adds.
 */
export class CulledInstance implements VisibilityInstance, DrawnInstance, FadedSurfaces {
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
   * Whether its pose and its box are known: `custom_aabb`, or the box its drawer measures. The cull
   * indexes no instance without a base, so its box is never read.
   */
  get isPlaced(): boolean {
    if (!this.hasBase) return true;
    if (!this.placement.nodeMatrixWorld(nodeMatrix)) return false;
    return this.customAabb !== null || this.placement.ownAabb(ownBox);
  }

  /** A base whose box has a surface (`renderer_scene_cull.cpp:1675-1681`). */
  get isIndexed(): boolean {
    if (!this.hasBase) return false;
    if (this.customAabb) return hasSurface(this.customAabb.size);
    return this.placement.ownAabb(ownBox) && hasSurface(ownBox.getSize(ownSize));
  }

  worldBox(target: THREE.Box3): void {
    // `custom_aabb` replaces the instance's own (`renderer_scene_cull.cpp:1988-1992`).
    if (this.customAabb) copyAabb(target, this.customAabb);
    else this.placement.ownAabb(target);
    this.placement.nodeMatrixWorld(nodeMatrix);
    target.applyMatrix4(nodeMatrix);
  }

  nodeMatrixWorld(target: THREE.Matrix4): boolean {
    return this.placement.nodeMatrixWorld(target);
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
