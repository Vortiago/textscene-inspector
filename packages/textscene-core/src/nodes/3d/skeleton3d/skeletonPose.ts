/**
 * The pose model of a Skeleton3D: its bone table, and the automatic skin Godot derives from it. A
 * bone writes a rest and a pose, and a MeshInstance3D without a `skin` binds to the skin the
 * skeleton makes of them. THREE-free, so the parser, the scene pass and the tests all read it.
 */

import {
  affineInverseTransform3D,
  decomposeTransform3D,
  identityTransform3D,
  interpolateTransform3D,
  multiplyTransform3D,
  sameTransform3D,
  transform3DFromQuaternionScale,
  type Transform3D,
} from '../../../godot/math/transform3d.js';
import { normalizedQuaternion, type Quaternion } from '../../../godot/math/quaternion.js';
import { vector3Scaled, type Vector3 } from '../../../godot/math/vector.js';

/** One entry of `bones/<i>/…` (`skeleton_3d.h:105-113`). */
export interface Bone {
  name: string;
  /** The index of the parent bone, or -1 for none. An index past the last bone also means none. */
  parent: number;
  rest: Transform3D;
  enabled: boolean;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

/** A bone as `add_bone` makes it (`skeleton_3d.cpp:603-619`): enabled, at the identity pose. */
export function newBone(name: string): Bone {
  return {
    name,
    parent: -1,
    rest: identityTransform3D(),
    enabled: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

/** The parts of a bone pose that a clip writes: a part it does not key stays undefined and keeps the file pose. */
export interface BonePose {
  position?: Vector3;
  rotation?: Quaternion;
  scale?: Vector3;
}

/** The poses a clip writes to a skeleton, by bone name. */
export type AnimatedPose = ReadonlyMap<string, BonePose>;

/**
 * The bones with the poses of a clip over their file pose, as `AnimationMixer` applies a bone track
 * (`animation_mixer.cpp:1878-1891`). A name finds the first bone of that name, as `find_bone` does, and
 * a name no bone carries writes nothing. A position takes the `motion_scale` of the skeleton
 * (`:1016-1024`), and a rotation comes out of the blend normalised.
 */
export function animatedBones(bones: readonly Bone[], animated: AnimatedPose, motionScale: number): Bone[] {
  const written = new Set<string>();
  return bones.map((bone) => {
    const pose = animated.get(bone.name);
    if (!pose || written.has(bone.name)) return bone;
    written.add(bone.name);
    return {
      ...bone,
      ...(pose.position && { position: vector3Scaled(pose.position, motionScale) }),
      ...(pose.rotation && { rotation: normalizedQuaternion(pose.rotation) }),
      ...(pose.scale && { scale: pose.scale }),
    };
  });
}

/** The names of `animated` that are not in `boneNames`, the names of the bones of a skeleton. */
export function unknownBoneNames(boneNames: ReadonlySet<string>, animated: AnimatedPose): string[] {
  return [...animated.keys()].filter((name) => !boneNames.has(name));
}

/**
 * The matrix that moves a vertex bound to each bone of the automatic skin from its rest to its
 * pose: the global pose times the inverse of the global rest (`skeleton_3d.cpp:398-403, 1014`),
 * one entry per bone in table order. The modifiers edit the pose first, in order, and the file pose
 * stays as it is (`:405-412`).
 *
 * `show_rest_only` poses every bone at its rest (`:1104`), as does a disabled bone. A bone that no
 * root reaches, which only a parent cycle makes, keeps the identity Godot allocates for it.
 *
 * @canonical The automatic skin of a Skeleton3D's bones
 */
export function automaticSkinMatrices(
  bones: readonly Bone[],
  showRestOnly: boolean,
  modifiers: readonly PoseModifier[] = []
): Transform3D[] {
  const poses = new BonePoses(bones, showRestOnly);
  for (const modifier of modifiers) runModifier(poses, modifier);
  return poses.skinMatrices();
}

/**
 * One SkeletonModifier3D's edit of the pose, as `Skeleton3D::_process_modifiers` runs it
 * (`skeleton_3d.cpp:1166-1204`).
 */
export interface PoseModifier {
  /** `SkeletonModifier3D::influence`. Below one, the edit is blended back toward the old pose. */
  influence: number;
  edit: (poses: BonePoses) => void;
}

/** `_process_modifiers` for one modifier: a full edit, or one blended by `influence` below one. */
function runModifier(poses: BonePoses, { influence, edit }: PoseModifier): void {
  if (!(influence < 1)) {
    edit(poses);
    return;
  }
  const before = poses.poseTransforms();
  edit(poses);
  poses.blendFrom(before, influence);
}

/**
 * The bone poses a modifier edits and reads, over a copy of the file's bones: the `Skeleton3D`
 * bone calls a `SkeletonModifier3D` makes. An index past the last bone reads as Godot's
 * `ERR_FAIL_INDEX` default and writes nothing.
 */
export class BonePoses {
  private readonly bones: Bone[];
  private readonly order: number[];
  /** Written only by `globals`; every setter clears it. */
  private cache: { rests: Transform3D[]; poses: Transform3D[] } | undefined;

  constructor(
    bones: readonly Bone[],
    private readonly showRestOnly: boolean
  ) {
    // A copy of the list only: `write` replaces a bone and never changes one.
    this.bones = [...bones];
    this.order = boneOrder(this.bones);
  }

  /** `Skeleton3D::get_bone_count`. */
  get boneCount(): number {
    return this.bones.length;
  }

  /** `Skeleton3D::find_bone`: the first bone called `name`, else -1. */
  findBone(name: string): number {
    return this.bones.findIndex((bone) => bone.name === name);
  }

  /** `Skeleton3D::get_bone_parent`: the parent index, or -1 for none. */
  parentOf(index: number): number {
    const bone = this.bones[index];
    return bone ? parentOf(bone, this.bones.length) : -1;
  }

  /** `Skeleton3D::get_bone_rest`. */
  rest(index: number): Transform3D {
    return this.bones[index]?.rest ?? identityTransform3D();
  }

  /** `Skeleton3D::get_bone_pose`. */
  pose(index: number): Transform3D {
    const bone = this.bones[index];
    return bone ? poseOf(bone) : identityTransform3D();
  }

  /** `Skeleton3D::get_bone_global_pose`: the parents' poses under this one, rests where a bone is not posed. */
  globalPose(index: number): Transform3D {
    return this.globals().poses[index] ?? identityTransform3D();
  }

  /** `Skeleton3D::get_bone_pose_position`. */
  posePosition(index: number): Vector3 {
    return this.bones[index]?.position ?? { x: 0, y: 0, z: 0 };
  }

  /** `Skeleton3D::get_bone_pose_rotation`. */
  poseRotation(index: number): Quaternion {
    return this.bones[index]?.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  }

  /** `Skeleton3D::get_bone_pose_scale`. */
  poseScale(index: number): Vector3 {
    return this.bones[index]?.scale ?? { x: 1, y: 1, z: 1 };
  }

  /** `Skeleton3D::set_bone_pose_position` (`skeleton_3d.cpp:856-866`). */
  setPosePosition(index: number, position: Vector3): void {
    this.write(index, { position });
  }

  /** `Skeleton3D::set_bone_pose_rotation` (`:867-877`). */
  setPoseRotation(index: number, rotation: Quaternion): void {
    this.write(index, { rotation });
  }

  /** `Skeleton3D::set_bone_pose_scale` (`:878-888`). */
  setPoseScale(index: number, scale: Vector3): void {
    this.write(index, { scale });
  }

  /** `Skeleton3D::set_bone_pose` (`:842-854`): the position, rotation and scale of `pose`. */
  setPose(index: number, pose: Transform3D): void {
    this.write(index, { position: { ...pose.origin }, ...decomposeTransform3D(pose) });
  }

  /** The pose of every bone in table order, as `get_bone_pose` gives each. */
  poseTransforms(): Transform3D[] {
    return this.bones.map(poseOf);
  }

  /**
   * Sets each bone whose pose now differs from `before` to `before` interpolated to the pose by
   * `weight` (`skeleton_3d.cpp:1189-1196`). A bone the edit left alone is not touched.
   */
  blendFrom(before: readonly Transform3D[], weight: number): void {
    this.bones.forEach((bone, index) => {
      const after = poseOf(bone);
      if (!sameTransform3D(before[index]!, after))
        this.setPose(index, interpolateTransform3D(before[index]!, after, weight));
    });
  }

  /** The skin matrix of every bone: its global pose times the inverse of its global rest. */
  skinMatrices(): Transform3D[] {
    const { rests, poses } = this.globals();
    return poses.map((pose, i) => multiplyTransform3D(pose, affineInverseTransform3D(rests[i]!)));
  }

  private write(index: number, change: Partial<Pick<Bone, 'position' | 'rotation' | 'scale'>>): void {
    const bone = this.bones[index];
    if (!bone) return;
    this.bones[index] = { ...bone, ...change };
    this.cache = undefined;
  }

  private globals(): { rests: Transform3D[]; poses: Transform3D[] } {
    if (this.cache) return this.cache;
    const rests = this.bones.map(identityTransform3D);
    const poses = this.bones.map(identityTransform3D);
    for (const index of this.order) {
      const bone = this.bones[index]!;
      const parent = parentOf(bone, this.bones.length);
      const isPosed = bone.enabled && !this.showRestOnly;
      rests[index] = standOn(parent < 0 ? null : rests[parent]!, bone.rest);
      poses[index] = standOn(parent < 0 ? null : poses[parent]!, isPosed ? poseOf(bone) : bone.rest);
    }
    this.cache = { rests, poses };
    return this.cache;
  }
}

/** `Bone::update_pose_cache` (`skeleton_3d.h:118-124`). */
function poseOf({ rotation, scale, position }: Bone): Transform3D {
  return transform3DFromQuaternionScale(rotation, scale, position);
}

/** `local` under `parentGlobal`, or on the identity for a bone with no parent. */
function standOn(parentGlobal: Transform3D | null, local: Transform3D): Transform3D {
  return parentGlobal ? multiplyTransform3D(parentGlobal, local) : local;
}

/** `_update_process_order` (`:223-226`) turns a parent past the last bone into none. */
function parentOf(bone: Bone, boneCount: number): number {
  return bone.parent >= boneCount ? -1 : bone.parent;
}

/** The bone indices with every parent before its children: each root, then its subtree. */
function boneOrder(bones: readonly Bone[]): number[] {
  const children = new Map<number, number[]>();
  bones.forEach((bone, index) => {
    const parent = parentOf(bone, bones.length);
    const siblings = children.get(parent);
    if (siblings) siblings.push(index);
    else children.set(parent, [index]);
  });
  const order: number[] = [];
  const pending = (children.get(-1) ?? []).slice().reverse();
  for (let index = pending.pop(); index !== undefined; index = pending.pop()) {
    order.push(index);
    pending.push(...(children.get(index) ?? []).slice().reverse());
  }
  return order;
}
