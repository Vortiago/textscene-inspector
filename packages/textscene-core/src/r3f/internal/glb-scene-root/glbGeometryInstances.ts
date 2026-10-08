/**
 * The scene cull's instance of each GLB object Godot imports as a MeshInstance3D. An override node
 * in the instancing scene gives it a range, a transparency, a `cast_shadow` and a visibility
 * parent, as an authored MeshInstance3D has, and its path lets another node name it as a parent.
 */

import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { LiveNode } from '../../../resources/liveNode';
import { parseGeometryInstance3D } from '../../../nodes/3d/geometryinstance3d/parser';
import type { GeometryInstance3DProperties } from '../../../nodes/3d/geometryinstance3d/types';
import {
  isMeshInstance,
  meshInstanceSurfaces,
  type MeshSurface,
} from '../../../resources/formats/glb/meshInstances';
import { ShadowCastingSetting } from '../../../godot/rendering';
import { visibilityParentOf } from '../../../godot/visibilityParent';
import { joinPath } from '../../../utils/nodePath';
import {
  applyShadowCasting,
  rangedShadowCastingEffects,
  shadowCastingEffects,
  type ShadowCastingEffects,
} from '../../shadowCasting';
import { FadedMeshMaterials } from '../../materials/fadedMeshMaterials';
import { CulledInstance } from '../../visibilityRange/culledInstance';
import { registerVisibilityInstance } from '../../visibilityRange/visibilityScene';
import type { InstancePlacement } from '../../visibilityRange/placements';
import { useUniqueNamePaths } from '../../useUniqueNames';
import type { GlbObjectEntry } from './glbHierarchy';
import type { GlbRoot } from './GlbInstanceContext';
import { isApplicableGlbOverride, resolveGlbOverrideTarget } from './glbNodeOverrides';

/** A MeshInstance3D of a GLB, with its node data. */
interface GlbMeshInstance {
  object: THREE.Object3D;
  path: string | null;
  parentPath: string | null;
  properties: GeometryInstance3DProperties;
}

/**
 * Each MeshInstance3D under `object`, in `entries` order. A node without an override of its own is
 * at its `relPath` under the root, and takes its parent's visibility parent (`node_3d.cpp:1307-1318`).
 */
function glbMeshInstances(
  object: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  root: GlbRoot,
  uniquePaths: ReadonlyMap<string, string> | undefined
): GlbMeshInstance[] {
  const overrides = overridesByTarget(object, entries, root.overrides);
  const passedOn = new Map<THREE.Object3D, string | null>();
  const instances: GlbMeshInstance[] = [];
  for (const entry of entries) {
    const override = overrides.get(entry.object);
    const path =
      root.path === null
        ? null
        : joinPath(
            root.path,
            override ? joinPath(override.instanceSubPath ?? '', override.name) : entry.relPath
          );
    const properties = parseGeometryInstance3D(
      { type: 'node', attributes: { name: entry.object.name } },
      override?.rawProperties ?? {}
    );
    // `has`, not `??`: a parent whose own link resolves to none passes none on.
    const parent = entry.object.parent!;
    const inherited = passedOn.has(parent) ? (passedOn.get(parent) ?? null) : root.visibilityParent;
    const parentPath =
      path === null
        ? inherited
        : visibilityParentOf(path, properties.visibility_parent, inherited, uniquePaths);
    passedOn.set(entry.object, parentPath);
    if (isMeshInstance(entry.object)) instances.push({ object: entry.object, path, parentPath, properties });
  }
  return instances;
}

/** Each GLB object an override node applies to, with the first override that names it. */
function overridesByTarget(
  object: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  overrides: readonly LiveNode[]
): Map<THREE.Object3D, LiveNode> {
  const byTarget = new Map<THREE.Object3D, LiveNode>();
  for (const override of overrides) {
    if (!isApplicableGlbOverride(override)) continue;
    const target = resolveGlbOverrideTarget(object, entries, override);
    if (target && !byTarget.has(target)) byTarget.set(target, override);
  }
  return byTarget;
}

/** Registers each MeshInstance3D of the mounted GLB `object` with the scene cull. */
export function useGlbGeometryInstances(
  object: THREE.Object3D | undefined,
  entries: readonly GlbObjectEntry[],
  root: GlbRoot
): void {
  const scene = useThree((state) => state.scene);
  const uniquePaths = useUniqueNamePaths(root.path);
  const instances = useMemo(
    () => (object ? glbMeshInstances(object, entries, root, uniquePaths) : []),
    [object, entries, root, uniquePaths]
  );
  useLayoutEffect(() => {
    const releases = instances.map((instance) => cullMeshInstance(scene, instance));
    return () => releases.forEach((release) => release());
  }, [scene, instances]);
}

/** Puts one MeshInstance3D under the scene cull until the returned function runs. */
function cullMeshInstance(
  scene: THREE.Scene,
  { object, path, parentPath, properties }: GlbMeshInstance
): () => void {
  const instance = new CulledInstance();
  instance.update(path, parentPath, properties);
  instance.hasBase = true;
  const surfaces = meshInstanceSurfaces(object);
  instance.placement = glbPlacement(object, surfaces);
  const shadow = rangedShadowCastingEffects(properties.castShadow, instance);
  const releases = surfaces.map((surface) => fadeSurface(instance, surface, shadow));
  const unregister = registerVisibilityInstance(scene, instance);
  return () => {
    unregister();
    releases.forEach((release) => release());
  };
}

function fadeSurface(
  instance: CulledInstance,
  surface: MeshSurface,
  shadow: ShadowCastingEffects
): () => void {
  applyShadowCasting(surface, shadow);
  const materials = new FadedMeshMaterials(surface);
  const remove = instance.add(materials);
  return () => {
    remove();
    materials.dispose();
    // What `cloneWithMaterials` gives every surface of the import.
    applyShadowCasting(surface, shadowCastingEffects(ShadowCastingSetting.ON));
  };
}

/** The node's live pose, and the box of its surfaces in node space, which the import fixes. */
function glbPlacement(object: THREE.Object3D, surfaces: readonly MeshSurface[]): InstancePlacement {
  const box = surfacesBox(object, surfaces);
  return {
    nodeMatrixWorld(target) {
      target.copy(object.matrixWorld);
      return true;
    },
    ownAabb(target) {
      target.copy(box);
      return !box.isEmpty();
    },
  };
}

function surfacesBox(object: THREE.Object3D, surfaces: readonly MeshSurface[]): THREE.Box3 {
  const box = new THREE.Box3();
  const surfaceBox = new THREE.Box3();
  for (const surface of surfaces) {
    const { geometry } = surface;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    surfaceBox.copy(geometry.boundingBox!);
    // A primitive of a Group sits under it, at the transform GLTFLoader gives it.
    if (surface !== object) surfaceBox.applyMatrix4(surface.matrix);
    box.union(surfaceBox);
  }
  return box;
}
