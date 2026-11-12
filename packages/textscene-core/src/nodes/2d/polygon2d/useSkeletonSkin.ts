/**
 * Skins a Polygon2D's mesh with the Skeleton2D the scene pass bound it to. Each render reads the
 * pose of that skeleton and the drawn transform of the polygon, so a bone an AnimationPlayer or a
 * modification moves moves the skin in the same frame. The vertices are written again only when
 * the pose or the polygon moved.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  affineInverseTransform2DInto,
  multiplyTransform2DInto,
  mutableTransform2D,
} from '../../../godot/math/transform2d.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext.js';
import { canvasTransformInto, writeGodotPointAsThree } from '../../../r3f/node2dTransform.js';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera.js';
import { WorldMatrixWatch } from '../../../r3f/worldMatrixWatch.js';
import type { DrawnSkeletonPose } from '../skeleton2d/skeletonPose.js';
import { skeleton2DPoseAt } from '../skeleton2d/skeletonPoses.js';
import { skinnedPointsInto } from './polygonSkin.js';
import type { PolygonSkeletonBinding } from './skeletonBinding.js';

/**
 * Skins `mesh`, whose `geometry` holds the undeformed points, while `binding` is set, and writes
 * those points back once it is not. Without the registry of node objects, which holds the pose of
 * the skeleton, the mesh stays undeformed.
 */
export function useSkeletonSkin(
  mesh: THREE.Mesh | null,
  geometry: THREE.BufferGeometry | null,
  binding: PolygonSkeletonBinding | undefined
): void {
  const scene = useThree((state) => state.scene);
  const nodeObjects = useOptionalSelection()?.nodeObjectMap ?? null;
  useEffect(() => {
    if (!mesh || !geometry || !binding || !nodeObjects) return;
    const skin = new MeshSkin(mesh, geometry, binding, nodeObjects);
    const stop = observeSceneCamera(scene, () => skin.update());
    return () => {
      stop();
      skin.release();
    };
  }, [scene, mesh, geometry, binding, nodeObjects]);
}

class MeshSkin {
  private readonly restPoints: Vector2[];
  private readonly meshWatch = new WorldMatrixWatch();
  /** Written only by `update`: the pose the vertices were last written from, and its version then. */
  private writtenPose: DrawnSkeletonPose | null = null;
  private writtenVersion = -1;
  /** Written only by `skinned`, so a render where the skin moves builds no transform object. */
  private readonly skeletonToMesh = mutableTransform2D();
  /** Written only by `skinned`, and read by `write` in the same render. */
  private readonly skinnedBuffer: Vector2[];

  constructor(
    private readonly mesh: THREE.Mesh,
    private readonly geometry: THREE.BufferGeometry,
    private readonly binding: PolygonSkeletonBinding,
    private readonly nodeObjects: ReadonlyMap<string, THREE.Object3D>
  ) {
    this.restPoints = godotPointsOf(geometry, binding.influences.vertexCount);
    this.skinnedBuffer = this.restPoints.map(() => ({ x: 0, y: 0 }));
  }

  update(): void {
    const pose = skeleton2DPoseAt(this.nodeObjects, this.binding.skeletonPath)?.drawn();
    if (!pose) return;
    // Asked before the version, not short-circuited: the watch must see every render.
    const hasMeshMoved = this.meshWatch.hasMoved([this.mesh]);
    if (!hasMeshMoved && pose === this.writtenPose && pose.version === this.writtenVersion) return;
    this.writtenPose = pose;
    this.writtenVersion = pose.version;
    this.write(this.skinned(pose));
  }

  /** Writes the undeformed points back, so the next skin of this geometry starts from them. */
  release(): void {
    this.write(this.restPoints);
  }

  /** `T`, the polygon's global inverse times the skeleton's (`mesh_storage.cpp:1224-1225`). */
  private skinned({ skeletonGlobal, boneMatrices }: DrawnSkeletonPose): Vector2[] {
    const meshInverse = affineInverseTransform2DInto(
      this.skeletonToMesh,
      canvasTransformInto(this.skeletonToMesh, this.mesh)
    );
    multiplyTransform2DInto(this.skeletonToMesh, meshInverse, skeletonGlobal);
    return skinnedPointsInto(
      this.skinnedBuffer,
      this.restPoints,
      this.binding.influences,
      boneMatrices,
      this.skeletonToMesh
    );
  }

  private write(points: readonly Vector2[]): void {
    const position = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    for (let i = 0; i < points.length; i++) writeGodotPointAsThree(array, i * 3, points[i]!.x, points[i]!.y);
    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    if (this.geometry.boundingBox) this.geometry.computeBoundingBox();
  }
}

/** The first `count` points of `geometry`, back in Godot's +Y-down pixels. */
function godotPointsOf(geometry: THREE.BufferGeometry, count: number): Vector2[] {
  const position = geometry.getAttribute('position');
  return Array.from({ length: count }, (_, i) => ({ x: position.getX(i), y: 0 - position.getY(i) }));
}
