/**
 * Skins a Polygon2D's mesh with the Skeleton2D the scene pass bound it to. Each render reads the
 * drawn transforms of the polygon, the skeleton and its bones, after three updated the matrices, so
 * a bone an AnimationPlayer moves moves the skin in the same frame. The vertices are written again
 * only when one of those transforms moved.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  affineInverseTransform2D,
  multiplyTransform2D,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { trackTargetFinder } from '../../../r3f/animation/trackTargets.js';
import { canvasFrameOf } from '../../../r3f/canvasFrame.js';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext.js';
import { transform2DFromThreeMatrix, writeGodotPointAsThree } from '../../../r3f/node2dTransform.js';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera.js';
import { sameData } from '../../../utils/sameData.js';
import { skinnedPoints } from './polygonSkin.js';
import type { PolygonSkeletonBinding } from './skeletonBinding.js';

/**
 * Skins `mesh`, whose geometry holds the undeformed points, while `binding` is set. Without the
 * registry of node objects, which an AnimationPlayer binds through too, the mesh stays undeformed.
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

/** The transforms a skin reads, each in the pixels of the canvas its node draws in. */
interface SkinInputs {
  polygon: Transform2DColumns;
  skeleton: Transform2DColumns;
  bones: Transform2DColumns[];
}

class MeshSkin {
  private readonly restPoints: Vector2[];
  private bound: { skeleton: THREE.Object3D; bones: THREE.Object3D[] } | null = null;
  private skinnedFrom: SkinInputs | null = null;

  constructor(
    private readonly mesh: THREE.Mesh,
    private readonly geometry: THREE.BufferGeometry,
    private readonly binding: PolygonSkeletonBinding,
    private readonly nodeObjects: ReadonlyMap<string, THREE.Object3D>
  ) {
    this.restPoints = godotPointsOf(geometry, binding.influences.weights.length / 4);
  }

  update(): void {
    const bound = this.boundObjects();
    if (!bound) return;
    const inputs: SkinInputs = {
      polygon: canvasTransform(this.mesh),
      skeleton: canvasTransform(bound.skeleton),
      bones: bound.bones.map(canvasTransform),
    };
    if (sameData(inputs, this.skinnedFrom)) return;
    this.skinnedFrom = inputs;
    this.write(this.skinned(inputs));
  }

  /**
   * The bone matrices `accum * rest_inverse` (`skeleton_2d.cpp:592-603`), and `T`, the polygon's
   * global inverse times the skeleton's (`mesh_storage.cpp:1224-1225`).
   */
  private skinned({ polygon, skeleton, bones }: SkinInputs): Vector2[] {
    const skeletonInverse = affineInverseTransform2D(skeleton);
    const boneMatrices = bones.map((bone, i) =>
      multiplyTransform2D(multiplyTransform2D(skeletonInverse, bone), this.binding.restInverses[i]!)
    );
    const skeletonToMesh = multiplyTransform2D(affineInverseTransform2D(polygon), skeleton);
    return skinnedPoints(this.restPoints, this.binding.influences, boneMatrices, skeletonToMesh);
  }

  /** Writes the undeformed points back, so the next skin of this geometry starts from them. */
  release(): void {
    this.write(this.restPoints);
  }

  private write(points: readonly Vector2[]): void {
    const position = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    points.forEach((point, i) => writeGodotPointAsThree(array, i * 3, point.x, point.y));
    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    if (this.geometry.boundingBox) this.geometry.computeBoundingBox();
  }

  /** The skeleton and bone objects, found again once one of them has left the scene. */
  private boundObjects(): { skeleton: THREE.Object3D; bones: THREE.Object3D[] } | null {
    if (this.bound && isMounted(this.bound.skeleton) && this.bound.bones.every(isMounted)) return this.bound;
    const find = trackTargetFinder(this.nodeObjects);
    const skeleton = find(this.binding.skeletonPath);
    const bones = this.binding.bonePaths.map(find);
    this.bound = skeleton && bones.every((bone) => bone !== null) ? { skeleton, bones } : null;
    this.skinnedFrom = null;
    return this.bound;
  }
}

function isMounted(object: THREE.Object3D): boolean {
  return object.parent !== null;
}

/** The node's global transform in Godot pixels: its world matrix within the frame of its canvas. */
function canvasTransform(object: THREE.Object3D): Transform2DColumns {
  const frame = canvasFrameOf(object);
  const matrix = frame ? frame.matrixWorld.clone().invert().multiply(object.matrixWorld) : object.matrixWorld;
  return transform2DFromThreeMatrix(matrix);
}

/** The first `count` points of `geometry`, back in Godot's +Y-down pixels. */
function godotPointsOf(geometry: THREE.BufferGeometry, count: number): Vector2[] {
  const position = geometry.getAttribute('position');
  return Array.from({ length: count }, (_, i) => ({ x: position.getX(i), y: 0 - position.getY(i) }));
}
