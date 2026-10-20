/**
 * The LightmapGIs of one scene, and which one lights each node. A LightmapGI assigns its data to
 * its users once it enters the tree (`lightmap_gi.cpp:1507-1567`), and the renderer culls it by
 * its bake's bounds before each render (`renderer_scene_cull.cpp:2853`, `:2894-2895`). A lightmap
 * the cull leaves out lights no surface (`render_forward_clustered.cpp:985-1003`).
 */

import * as THREE from 'three';
import { EMPTY_AABB, hasSurface, type Aabb } from '../../godot/math/aabb';
import { resolveRelativePath } from '../../godot/string/nodePath';
import type { LightmapUser } from '../../resources/lightmapgidata/types';
import { cameraFrustum } from '../cameraFrustum';
import { compareReadyOrder, type TreeOrder } from '../contexts/TreeOrderContext';
import { observeSceneCamera } from '../sceneRenderCamera';
import { copyAabb } from '../visibilityRange/placements';
import { visibleInTree } from '../visibleInTree';

/** One LightmapGI as the surfaces it lights read it. Its component writes every field but `isDrawn`. */
export class LightmapInstance {
  order: TreeOrder = [];
  /** Each user by the node path it names. */
  users: ReadonlyMap<string, LightmapUser> = new Map();
  /** The atlas, every layer of every lightmap texture in order. Null until it loads. */
  atlas: THREE.DataArrayTexture | null = null;
  usesSphericalHarmonics = false;
  usesBicubicFilter = true;
  /** The bake's capture bounds, in the LightmapGI's space (`lightmap_gi.cpp:229`). */
  bounds: Aabb = EMPTY_AABB;
  /** Written only by the scene's `SceneLightmaps` before each render: whether the cull keeps it. */
  isDrawn = false;

  /** `object` is the LightmapGI's node, whose pose places the bounds and whose visibility hides it. */
  constructor(readonly object: THREE.Object3D) {}
}

/** The LightmapGI that lights a node, and the node's place in its atlas. */
export interface LightmapAssignment {
  lightmap: LightmapInstance;
  user: LightmapUser;
}

/**
 * Each user by the node path it names from the LightmapGI at `lightmapPath`. A later user of one
 * node replaces an earlier one, as each assignment does. A user that means a GridMap or MultiMesh
 * instance is left out: LightmapGI asks the node for that instance (`:1546-1550`), which no drawer
 * here gives.
 */
export function assignedUsers(
  lightmapPath: string,
  users: readonly LightmapUser[],
  uniquePaths: ReadonlyMap<string, string> | undefined
): Map<string, LightmapUser> {
  const assigned = new Map<string, LightmapUser>();
  for (const user of users) {
    if (user.subInstance >= 0) continue;
    const path = resolveRelativePath(lightmapPath, user.path, uniquePaths);
    if (path !== null) assigned.set(path, user);
  }
  return assigned;
}

/** Scratch for one render's cull: three renders one scene at a time. */
const frustum = new THREE.Frustum();
const worldBounds = new THREE.Box3();

export class SceneLightmaps {
  private readonly instances = new Set<LightmapInstance>();
  private readonly listeners = new Set<() => void>();
  /** Each node's assignment, kept until the instances change so a reader sees one object. */
  private readonly assignments = new Map<string, LightmapAssignment | null>();
  /** Set while the scene holds an instance. */
  private stopObserving: (() => void) | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  /** Holds `instance` until the returned function runs. */
  add(instance: LightmapInstance): () => void {
    this.instances.add(instance);
    this.stopObserving ??= observeSceneCamera(this.scene, (camera) => this.cull(camera));
    this.changed();
    return () => {
      this.instances.delete(instance);
      if (this.instances.size === 0) {
        this.stopObserving?.();
        this.stopObserving = null;
      }
      this.changed();
    };
  }

  /** Tells every reader that a held instance changed what it assigns. */
  changed(): void {
    this.assignments.clear();
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The assignment of the node at `path`, or null when no LightmapGI names it. */
  assignmentFor(path: string): LightmapAssignment | null {
    let assignment = this.assignments.get(path);
    if (assignment === undefined) {
      assignment = this.lastAssignmentOf(path);
      this.assignments.set(path, assignment);
    }
    return assignment;
  }

  /** The LightmapGI that assigns last wins: each assignment replaces the node's last. */
  private lastAssignmentOf(path: string): LightmapAssignment | null {
    let assignment: LightmapAssignment | null = null;
    for (const lightmap of [...this.instances].sort((a, b) => compareReadyOrder(a.order, b.order))) {
      const user = lightmap.users.get(path);
      if (user) assignment = { lightmap, user };
    }
    return assignment;
  }

  private cull(camera: THREE.Camera): void {
    cameraFrustum(camera, frustum);
    for (const instance of this.instances) instance.isDrawn = isCulledIn(instance);
  }
}

/** An instance whose bounds have no surface is never indexed (`renderer_scene_cull.cpp:1679-1681`). */
function isCulledIn({ atlas, bounds, object }: LightmapInstance): boolean {
  if (!atlas || !hasSurface(bounds.size) || !visibleInTree(object)) return false;
  copyAabb(worldBounds, bounds);
  worldBounds.applyMatrix4(object.matrixWorld);
  return frustum.intersectsBox(worldBounds);
}

/** Written only by `lightmapsOf`, and collected with its scene. */
const lightmapsByScene = new WeakMap<THREE.Scene, SceneLightmaps>();

/** The LightmapGIs of `scene`. */
export function lightmapsOf(scene: THREE.Scene): SceneLightmaps {
  let lightmaps = lightmapsByScene.get(scene);
  if (!lightmaps) {
    lightmaps = new SceneLightmaps(scene);
    lightmapsByScene.set(scene, lightmaps);
  }
  return lightmaps;
}
