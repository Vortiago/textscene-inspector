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
import { canvasFrameOf } from '../../../r3f/canvasFrame.js';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext.js';
import { lookupDrawnObjects, type DrawnObjects } from '../../../r3f/drawnObjects.js';
import { transform2DFromThreeMatrix, writeGodotPointAsThree } from '../../../r3f/node2dTransform.js';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera.js';
import { skinnedPoints } from './polygonSkin.js';
import type { PolygonSkeletonBinding } from './skeletonBinding.js';

/**
 * Skins `mesh`, whose `geometry` holds the undeformed points, while `binding` is set, and writes
 * those points back once it is not. Without the registry of node objects, which an AnimationPlayer
 * binds through too, the mesh stays undeformed.
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

/** The world matrix terms a 2D transform reads: the x and y columns and the origin. */
const TRANSFORM_2D_ELEMENTS = [0, 1, 4, 5, 12, 13] as const;

/** The drawn skeleton and bones a skin reads, and every object whose world matrix moves the skin. */
interface SkinObjects {
  skeleton: THREE.Object3D;
  bones: THREE.Object3D[];
  /** The mesh, the frame of its canvas and of the skeleton's, the skeleton, and each bone. */
  watched: (THREE.Object3D | null)[];
}

class MeshSkin {
  private readonly restPoints: Vector2[];
  private readonly paths: string[];
  /** Written only by `update`, each time the lookup finds other objects. */
  private drawn: DrawnObjects | null = null;
  /** Written only by `update` with `drawn`: null while the skeleton or a bone is not drawn. */
  private objects: SkinObjects | null = null;
  /**
   * The world matrix terms of every watched object at the last write, so a render where nothing
   * moved builds no transform. Two buffers swap, so a render where nothing moved allocates none.
   */
  private writtenAt: Float64Array;
  private readAt: Float64Array;

  constructor(
    private readonly mesh: THREE.Mesh,
    private readonly geometry: THREE.BufferGeometry,
    private readonly binding: PolygonSkeletonBinding,
    private readonly nodeObjects: ReadonlyMap<string, THREE.Object3D>
  ) {
    this.restPoints = godotPointsOf(geometry, binding.influences.vertexCount);
    this.paths = [binding.skeletonPath, ...binding.bonePaths];
    const terms = (this.paths.length + 3) * TRANSFORM_2D_ELEMENTS.length;
    this.writtenAt = new Float64Array(terms).fill(NaN);
    this.readAt = new Float64Array(terms);
  }

  update(): void {
    const drawn = lookupDrawnObjects(this.nodeObjects, this.paths, this.drawn);
    if (drawn !== this.drawn) {
      this.drawn = drawn;
      this.objects = skinObjectsOf(this.mesh, drawn.objects);
    }
    if (!this.objects || !this.moved(this.objects.watched)) return;
    this.write(this.skinned(this.objects));
  }

  /** Writes the undeformed points back, so the next skin of this geometry starts from them. */
  release(): void {
    this.write(this.restPoints);
  }

  /** Whether a world matrix of `objects` moved since the last write. A null frame reads as zeros. */
  private moved(objects: readonly (THREE.Object3D | null)[]): boolean {
    let at = 0;
    for (const object of objects) {
      for (const element of TRANSFORM_2D_ELEMENTS)
        this.readAt[at++] = object?.matrixWorld.elements[element] ?? 0;
    }
    const isSame = this.readAt.every((term, i) => term === this.writtenAt[i]);
    [this.writtenAt, this.readAt] = [this.readAt, this.writtenAt];
    return !isSame;
  }

  /**
   * The bone matrices `accum * rest_inverse` (`skeleton_2d.cpp:592-603`), and `T`, the polygon's
   * global inverse times the skeleton's (`mesh_storage.cpp:1224-1225`). A bone joins its skeleton
   * through Bone2D parents only, so it draws in the skeleton's canvas.
   */
  private skinned({ skeleton, bones }: SkinObjects): Vector2[] {
    const skeletonGlobal = canvasTransform(skeleton);
    const skeletonInverse = affineInverseTransform2D(skeletonGlobal);
    const boneMatrices = bones.map((bone, i) =>
      multiplyTransform2D(
        multiplyTransform2D(skeletonInverse, canvasTransform(bone)),
        this.binding.restInverses[i]!
      )
    );
    const skeletonToMesh = multiplyTransform2D(
      affineInverseTransform2D(canvasTransform(this.mesh)),
      skeletonGlobal
    );
    return skinnedPoints(this.restPoints, this.binding.influences, boneMatrices, skeletonToMesh);
  }

  private write(points: readonly Vector2[]): void {
    const position = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    points.forEach((point, i) => writeGodotPointAsThree(array, i * 3, point.x, point.y));
    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    if (this.geometry.boundingBox) this.geometry.computeBoundingBox();
  }
}

/** The objects of {@link SkinObjects} from the drawn skeleton and bones, or null where one is missing. */
function skinObjectsOf(mesh: THREE.Mesh, drawn: readonly (THREE.Object3D | null)[]): SkinObjects | null {
  const [skeleton, ...bones] = drawn;
  if (!skeleton || !bones.every((bone): bone is THREE.Object3D => bone !== null)) return null;
  const frames = [canvasFrameOf(mesh), canvasFrameOf(skeleton)];
  return { skeleton, bones, watched: [mesh, ...frames, skeleton, ...bones] };
}

/** Written only by {@link canvasTransform}, and read back before it returns. */
const scratchMatrix = new THREE.Matrix4();

/** The node's global transform in Godot pixels: its world matrix within the frame of its canvas. */
function canvasTransform(object: THREE.Object3D): Transform2DColumns {
  const frame = canvasFrameOf(object);
  const matrix = frame
    ? scratchMatrix.copy(frame.matrixWorld).invert().multiply(object.matrixWorld)
    : object.matrixWorld;
  return transform2DFromThreeMatrix(matrix);
}

/** The first `count` points of `geometry`, back in Godot's +Y-down pixels. */
function godotPointsOf(geometry: THREE.BufferGeometry, count: number): Vector2[] {
  const position = geometry.getAttribute('position');
  return Array.from({ length: count }, (_, i) => ({ x: position.getX(i), y: 0 - position.getY(i) }));
}
