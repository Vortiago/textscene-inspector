/**
 * The LightmapGIs of one scene, and which one lights each node. A LightmapGI assigns its data to
 * its users once it enters the tree (`lightmap_gi.cpp:1507-1567`), and the renderer culls it by
 * its bake's bounds before each render (`renderer_scene_cull.cpp:2853`, `:2894-2895`). A lightmap
 * the cull leaves out lights no surface (`render_forward_clustered.cpp:985-1003`).
 */

import * as THREE from 'three';
import { EMPTY_AABB, hasSurface, type Aabb } from '../../godot/math/aabb';
import type { EnumValue } from '../../godot/classdb/enumNames';
import {
  LIGHTMAP_BICUBIC_FILTER_DEFAULT,
  LIGHTMAP_NODE_ITSELF,
  ShadowmaskMode,
} from '../../godot/scene/lightmapGi';
import { resolveRelativePath } from '../../godot/string/nodePath';
import type { LightmapUser } from '../../resources/lightmapgidata/types';
import { perObject } from '../../utils/perObject';
import { cameraFrustum } from '../cameraFrustum';
import { compareReadyOrder, type TreeOrder } from '../contexts/TreeOrderContext';
import { observeSceneCamera } from '../sceneRenderCamera';
import { copyAabb } from '../visibilityRange/placements';
import { visibleInTree } from '../visibleInTree';

/** One LightmapGI as the surfaces it lights read it. Its component writes every field but `isDrawn`. */
export class LightmapInstance {
  order: TreeOrder = [];
  /** Each user by {@link lightmapUserKey}. */
  users: ReadonlyMap<string, LightmapUser> = new Map();
  /**
   * The atlas, every layer of every lightmap texture in order. Null until it loads. The alpha of the
   * first layer of each slice holds that slice's shadowmask, when the bake has one.
   */
  atlas: THREE.DataArrayTexture | null = null;
  /** None until the atlas holds the shadowmask, whatever the node says. */
  shadowmaskMode: EnumValue<typeof ShadowmaskMode> = ShadowmaskMode.NONE;
  usesSphericalHarmonics = false;
  usesBicubicFilter: boolean = LIGHTMAP_BICUBIC_FILTER_DEFAULT;
  /** The bake's capture bounds, in the LightmapGI's space (`lightmap_gi.cpp:229`). */
  bounds: Aabb = EMPTY_AABB;
  /**
   * The factor the atlas reads at: the world's exposure over the bake's, or 1 without camera
   * attributes (`render_forward_clustered.cpp:1222-1229`).
   */
  exposureScale = 1;
  /** Written only by the scene's `SceneLightmaps` before each render: whether the cull keeps it. */
  isDrawn = false;

  /** `object` is the LightmapGI's node, whose pose places the bounds and whose visibility hides it. */
  constructor(readonly object: THREE.Object3D) {}
}

/**
 * The factor a lightmap's atlas reads at: the world's exposure normalisation over the bake's, or 1
 * with no camera attributes (`render_forward_clustered.cpp:1222-1229`). Godot divides by the baked
 * exposure as it is, so a baked exposure of 0 gives infinity there too.
 */
export function lightmapExposureScale(normalization: number | null, bakedExposure: number): number {
  return normalization === null ? 1 : normalization / bakedExposure;
}

/** The LightmapGI that lights a node, and the node's place in its atlas. */
export interface LightmapAssignment {
  lightmap: LightmapInstance;
  user: LightmapUser;
}

/** The key of the node at `path`, or of its baked mesh `subInstance`, in a LightmapInstance's users. */
function lightmapUserKey(path: string, subInstance: number): string {
  // A newline cannot appear in a node name, so no node path collides with a baked mesh's key.
  return subInstance === LIGHTMAP_NODE_ITSELF ? path : `${path}\n${subInstance}`;
}

/**
 * Each user by the key of what it names from the LightmapGI at `lightmapPath`: a node, or one of
 * its baked meshes. A later user of one key replaces an earlier one, as each assignment does.
 */
export function assignedUsers(
  lightmapPath: string,
  users: readonly LightmapUser[],
  uniquePaths: ReadonlyMap<string, string> | undefined
): Map<string, LightmapUser> {
  const assigned = new Map<string, LightmapUser>();
  for (const user of users) {
    const path = resolveRelativePath(lightmapPath, user.path, uniquePaths);
    if (path !== null) assigned.set(lightmapUserKey(path, user.subInstance), user);
  }
  return assigned;
}

/** Scratch for one render's cull: three renders one scene at a time. */
const frustum = new THREE.Frustum();
const worldBounds = new THREE.Box3();

class SceneLightmaps {
  private readonly instances = new Set<LightmapInstance>();
  private readonly listeners = new Set<() => void>();
  /** Each key's assignment, kept until the instances change so a reader sees one object. */
  private readonly assignments = new Map<string, LightmapAssignment | null>();
  /** The instances in ready order, built on the first lookup after a change. */
  private readyOrder: LightmapInstance[] | null = null;
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
    this.readyOrder = null;
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The assignment of the node at `path`, or of its baked mesh `subInstance`, or null when none names it. */
  assignmentFor(path: string, subInstance = LIGHTMAP_NODE_ITSELF): LightmapAssignment | null {
    const key = lightmapUserKey(path, subInstance);
    let assignment = this.assignments.get(key);
    if (assignment === undefined) {
      assignment = this.lastAssignmentOf(key);
      this.assignments.set(key, assignment);
    }
    return assignment;
  }

  /** The LightmapGI that assigns last wins: each assignment replaces the node's last. */
  private lastAssignmentOf(key: string): LightmapAssignment | null {
    let assignment: LightmapAssignment | null = null;
    this.readyOrder ??= [...this.instances].sort((a, b) => compareReadyOrder(a.order, b.order));
    for (const lightmap of this.readyOrder) {
      const user = lightmap.users.get(key);
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

/** The LightmapGIs of `scene`, collected with its scene. */
export const lightmapsOf = perObject((scene: THREE.Scene) => new SceneLightmaps(scene));
