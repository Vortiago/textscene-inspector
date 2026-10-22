/**
 * The scene cull's instance of each GLB object Godot imports as a MeshInstance3D. An override node
 * in the instancing scene gives it a range, a transparency, a `cast_shadow` and a visibility
 * parent, as an authored MeshInstance3D has, and its path lets another node name it as a parent.
 */

import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { parseGeometryInstance3D } from '../../../nodes/3d/geometryinstance3d/parser';
import type { GeometryInstance3DProperties } from '../../../nodes/3d/geometryinstance3d/types';
import {
  isMeshInstance,
  meshInstanceSurfaces,
  type MeshSurface,
} from '../../../resources/formats/glb/meshInstances';
import { ShadowCastingSetting } from '../../../godot/rendering/rendering';
import { applyShadowCasting, rangedShadowCastingEffects, shadowCastingEffects } from '../../shadowCasting';
import { FadedMeshMaterials } from '../../materials/fadedMeshMaterials';
import { CulledInstance } from '../../visibilityRange/culledInstance';
import { registerVisibilityInstance } from '../../visibilityRange/visibilityScene';
import type { InstancePlacement } from '../../visibilityRange/placements';
import { visibleInTree } from '../../visibleInTree';
import type { NodePlace } from '../../visibilityRange/visibilityScene';
import { childOrders, useTreeOrder, type TreeOrder } from '../../contexts/TreeOrderContext';
import { lightmapsOf, type LightmapAssignment } from '../../lightmap/sceneLightmaps';
import { glbObjectName, type GlbObjectEntry } from './glbHierarchy';
import type { GlbNodeLink } from './glbNodeLinks';
import type { GlbRoot } from './GlbInstanceContext';

/** A MeshInstance3D of a GLB, with its node data. */
interface GlbMeshInstance {
  object: THREE.Object3D;
  place: NodePlace;
  properties: GeometryInstance3DProperties;
}

/**
 * Each MeshInstance3D of `object`, the GLB root, then each under it in `links` order, which is
 * the GLB's tree order below `rootOrder`. The root is the node that instances the GLB, with its
 * properties.
 */
function glbMeshInstances(
  object: THREE.Object3D,
  links: readonly GlbNodeLink[],
  root: GlbRoot,
  rootOrder: TreeOrder
): GlbMeshInstance[] {
  const orders = childOrders(rootOrder, links.length);
  const instances: GlbMeshInstance[] = [];
  if (isMeshInstance(object)) {
    instances.push({
      object,
      place: { path: root.path, parentPath: root.visibilityParent, order: rootOrder },
      properties: parseGeometryInstance3D(
        { type: 'node', attributes: { name: glbObjectName(object) } },
        root.rawProperties
      ),
    });
  }
  links.forEach(({ entry, properties, place }, i) => {
    if (!isMeshInstance(entry.object)) return;
    instances.push({ object: entry.object, place: { ...place, order: orders[i]! }, properties });
  });
  return instances;
}

/**
 * Registers each MeshInstance3D of the mounted GLB `object` with the scene cull, and gives it the
 * lightmap of the LightmapGI that names it. `links` are `entries` as `glbNodeLinks` reads them. Each keeps one instance while its object is mounted,
 * as an authored MeshInstance3D does, so a scene edit keeps the instance's previous visibility per
 * camera and its faded materials.
 */
export function useGlbGeometryInstances(
  object: THREE.Object3D | undefined,
  entries: readonly GlbObjectEntry[],
  root: GlbRoot,
  links: readonly GlbNodeLink[]
): void {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const rootOrder = useTreeOrder();
  const instances = useMemo(
    () => (object ? glbMeshInstances(object, links, root, rootOrder) : []),
    [object, links, root, rootOrder]
  );
  const culled = useRef(new Map<THREE.Object3D, CulledMeshInstance>());
  useLayoutEffect(() => {
    if (!object) return;
    const meshes = [object, ...entries.map((entry) => entry.object)].filter(isMeshInstance);
    const releases = meshes.map((mesh) => cullMeshInstance(scene, mesh, culled.current));
    return () => releases.forEach((release) => release());
  }, [scene, object, entries]);
  // After the effect above on the same commit, so a remounted instance takes its node data at once.
  useLayoutEffect(() => {
    for (const { object: meshObject, place, properties } of instances) {
      culled.current.get(meshObject)?.update(place, properties);
    }
  }, [scene, object, entries, instances]);
  useLayoutEffect(() => {
    const lightmaps = lightmapsOf(scene);
    const assignLightmaps = () => {
      for (const { object: meshObject, place } of instances) {
        culled.current
          .get(meshObject)
          ?.setLightmap(place.path === null ? null : lightmaps.assignmentFor(place.path));
      }
      invalidate();
    };
    assignLightmaps();
    return lightmaps.subscribe(assignLightmaps);
  }, [scene, instances, invalidate]);
}

/** One MeshInstance3D's cull instance and the faded materials of its surfaces, kept while its object is mounted. */
class CulledMeshInstance {
  readonly instance = new CulledInstance();
  /** Filled by `fadeSurface`, one per surface. */
  readonly materials: FadedMeshMaterials[] = [];

  constructor(private readonly surfaces: readonly MeshSurface[]) {}

  setLightmap(lightmap: LightmapAssignment | null): void {
    for (const materials of this.materials) materials.setLightmap(lightmap);
  }

  update(place: NodePlace, properties: GeometryInstance3DProperties): void {
    this.instance.update(place, properties);
    const shadow = rangedShadowCastingEffects(properties.castShadow, this.instance);
    for (const surface of this.surfaces) applyShadowCasting(surface, shadow);
  }
}

/** Puts one MeshInstance3D under the scene cull, in `culled`, until the returned function runs. */
function cullMeshInstance(
  scene: THREE.Scene,
  object: THREE.Object3D,
  culled: Map<THREE.Object3D, CulledMeshInstance>
): () => void {
  const surfaces = meshInstanceSurfaces(object);
  const mesh = new CulledMeshInstance(surfaces);
  mesh.instance.hasBase = true;
  mesh.instance.placement = glbPlacement(object, surfaces);
  const releases = surfaces.map((surface) => fadeSurface(mesh, surface));
  const unregister = registerVisibilityInstance(scene, mesh.instance);
  culled.set(object, mesh);
  return () => {
    culled.delete(object);
    unregister();
    releases.forEach((release) => release());
  };
}

function fadeSurface(mesh: CulledMeshInstance, surface: MeshSurface): () => void {
  const materials = new FadedMeshMaterials(surface);
  mesh.materials.push(materials);
  const remove = mesh.instance.add(materials);
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
    isVisibleInTree: () => visibleInTree(object),
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
