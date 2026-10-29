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
import {
  normalizedQuaternion,
  QUATERNION_IDENTITY,
  quaternionInverse,
  quaternionMultiply,
  quaternionSlerp,
  type Quaternion,
} from '../../../godot/math/quaternion.js';
import { vector3Add, vector3Scaled, vector3Sub, type Vector3 } from '../../../godot/math/vector.js';
import type { SkinBind } from '../../../resources/skin/types.js';

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
    rotation: QUATERNION_IDENTITY,
    scale: { x: 1, y: 1, z: 1 },
  };
}

/**
 * The parts of a bone pose that clips write. A part holds the value of each track that keys it, in
 * track order, and a part no track keys is undefined and keeps the file pose.
 */
export interface BonePose {
  position?: readonly Vector3[];
  rotation?: readonly Quaternion[];
  scale?: readonly Vector3[];
}

/** A bind of a Skin once its bone is found: the bone it moves with, and its bind pose. */
export interface SkinBinding {
  bone: number;
  pose: Transform3D;
}

/**
 * The matrix of a bind whose bone the skeleton lacks: Godot skips it (`skeleton_3d.cpp:401`) and the
 * zeroed bone buffer keeps zeros (`mesh_storage.cpp:2358`), which collapse the vertices bound to it.
 */
const COLLAPSED_BIND_MATRIX: Transform3D = {
  basis_x: { x: 0, y: 0, z: 0 },
  basis_y: { x: 0, y: 0, z: 0 },
  basis_z: { x: 0, y: 0, z: 0 },
  origin: { x: 0, y: 0, z: 0 },
};

/** The poses a clip writes to a skeleton, by bone name. */
export type AnimatedPose = ReadonlyMap<string, BonePose>;

/**
 * The bone tracks of a clip as the mixer applies them (`animation_mixer.cpp:1375, 1463, 1551`): a
 * part starts at the rest of the bone and each track adds its offset from the rest (a rotation
 * turns by it), then `set_bone_pose_*` writes the sum (`:1878-1891`). A name finds the first bone of
 * that name, as `find_bone` does, and a name no bone carries goes to `onUnknownBone`. A position
 * takes the `motion_scale` of the skeleton (`:1016-1024`). Runs before the modifiers, as the
 * mixer writes the pose before `_process_modifiers`.
 */
export function animationPass(
  animated: AnimatedPose,
  motionScale: number,
  onUnknownBone: (name: string) => void
): PoseModifier {
  return {
    influence: 1,
    edit: (poses) => {
      animated.forEach((written, name) => {
        const index = poses.rig.findBone(name);
        if (index < 0) {
          onUnknownBone(name);
          return;
        }
        const { origin, rotation, rotationInverse, scale } = poses.rig.decomposedRest(index);
        if (written.position) {
          const scaled =
            motionScale === 1
              ? written.position
              : written.position.map((position) => vector3Scaled(position, motionScale));
          poses.setPosePosition(index, summedOffsets(origin, scaled));
        }
        if (written.rotation)
          poses.setPoseRotation(index, composedTurns(rotation, rotationInverse, written.rotation));
        if (written.scale) poses.setPoseScale(index, summedOffsets(scale, written.scale));
      });
    },
  };
}

/** `init + (value - init) * 1` for each track in turn, which is `t->loc += (loc - init) * blend`. */
function summedOffsets(init: Vector3, values: readonly Vector3[]): Vector3 {
  return values.reduce((sum, value) => vector3Add(sum, vector3Sub(value, init)), init);
}

/** `interpolate_via_rest(rotation, value, 1, init)` for each track in turn (`animation.cpp:5700-5707`). */
function composedTurns(init: Quaternion, initInverse: Quaternion, values: readonly Quaternion[]): Quaternion {
  return values.reduce(
    (rotation, value) =>
      normalizedQuaternion(
        quaternionMultiply(
          rotation,
          quaternionSlerp(QUATERNION_IDENTITY, quaternionMultiply(initInverse, value), 1)
        )
      ),
    init
  );
}

/**
 * The matrix that moves a vertex bound to each bone of the automatic skin from its rest to its
 * pose: the global pose times the inverse of the global rest (`skeleton_3d.cpp:398-403, 1014`),
 * one entry per bone in table order. The modifiers edit the pose first, in order, and the file pose
 * stays as it is (`:405-412`).
 *
 * `show_rest_only` poses every bone at its rest (`:1104`), as does a disabled bone. A bone that no
 * root reaches, which only a parent cycle makes, keeps the identity Godot allocates for it.
 * A mesh with a `skin` takes {@link skinMatricesUnder} with the binds of that Skin instead.
 *
 * @canonical The automatic skin of a Skeleton3D's bones
 */
export function automaticSkinMatrices(
  bones: readonly Bone[],
  showRestOnly: boolean,
  modifiers: readonly PoseModifier[] = []
): Transform3D[] {
  return skinMatricesUnder(new BonePoses(bones, showRestOnly), modifiers);
}

/**
 * {@link automaticSkinMatrices} on `poses`, which start again from the file pose. A caller that
 * skins one skeleton every frame keeps its `BonePoses`, and with it the rig. With `bindings` of a
 * Skin it gives one matrix for each bind, in bind order, in place of one for each bone.
 */
export function skinMatricesUnder(
  poses: BonePoses,
  modifiers: readonly PoseModifier[],
  bindings?: readonly SkinBinding[]
): Transform3D[] {
  poses.reset();
  for (const modifier of modifiers) runModifier(poses, modifier);
  return bindings ? poses.bindMatrices(bindings) : poses.skinMatrices();
}

/** The rest of a bone taken apart, which an animated part is measured from. */
interface DecomposedRest {
  origin: Vector3;
  rotation: Quaternion;
  rotationInverse: Quaternion;
  scale: Vector3;
}

/**
 * What the bones of a Skeleton3D fix for good, whatever the poses do: the order the parents come
 * in, the global rests and their inverses, the bone names and the rests taken apart. The
 * animation pass reads these every frame, so they are built once.
 */
class SkeletonRig {
  readonly order: number[];
  /** The global rest of each bone. */
  readonly globalRests: Transform3D[];
  /**
   * The Skin `create_skin_from_rest_transforms` makes: bind `i` is bone `i`, posed at the inverse of
   * its global rest (`skeleton_3d.cpp:975-1014`). A mesh with no `skin` binds to it.
   */
  readonly automaticBindings: SkinBinding[];
  private readonly boneIndexByName = new Map<string, number>();
  /** Written only by `decomposedRest`, which fills an entry the first time a bone asks. */
  private readonly decomposedRests: (DecomposedRest | undefined)[];

  constructor(readonly bones: readonly Bone[]) {
    this.order = boneOrder(bones);
    this.globalRests = bones.map(identityTransform3D);
    for (const index of this.order) {
      const parent = parentOf(bones[index]!, bones.length);
      this.globalRests[index] = standOn(parent < 0 ? null : this.globalRests[parent]!, bones[index]!.rest);
    }
    this.automaticBindings = this.globalRests.map((rest, bone) => ({
      bone,
      pose: affineInverseTransform3D(rest),
    }));
    // The first bone of a name wins, as `find_bone` does.
    bones.forEach(({ name }, index) => {
      if (!this.boneIndexByName.has(name)) this.boneIndexByName.set(name, index);
    });
    this.decomposedRests = bones.map(() => undefined);
  }

  /** `Skeleton3D::find_bone`: the first bone called `name`, else -1. */
  findBone(name: string): number {
    return this.boneIndexByName.get(name) ?? -1;
  }

  decomposedRest(index: number): DecomposedRest {
    const kept = this.decomposedRests[index];
    if (kept) return kept;
    const { rest } = this.bones[index]!;
    const { rotation, scale } = decomposeTransform3D(rest);
    const decomposed = { origin: rest.origin, rotation, rotationInverse: quaternionInverse(rotation), scale };
    this.decomposedRests[index] = decomposed;
    return decomposed;
  }
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
  /** Written only by `globals`; every setter and `reset` clear it. */
  private cache: Transform3D[] | undefined;

  constructor(
    bones: readonly Bone[],
    private readonly showRestOnly: boolean,
    readonly rig = new SkeletonRig(bones)
  ) {
    // A copy of the list only: `write` replaces a bone and never changes one.
    this.bones = [...bones];
  }

  /** Puts every bone back to the pose of the file, so the next frame edits a pose as `new` would. */
  reset(): void {
    this.rig.bones.forEach((bone, index) => {
      this.bones[index] = bone;
    });
    this.cache = undefined;
  }

  /** `Skeleton3D::get_bone_count`. */
  get boneCount(): number {
    return this.bones.length;
  }

  /** `Skeleton3D::find_bone`: the first bone called `name`, else -1. */
  findBone(name: string): number {
    return this.rig.findBone(name);
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
    return this.globals()[index] ?? identityTransform3D();
  }

  /** `Skeleton3D::get_bone_pose_position`. */
  posePosition(index: number): Vector3 {
    return this.bones[index]?.position ?? { x: 0, y: 0, z: 0 };
  }

  /** `Skeleton3D::get_bone_pose_rotation`. */
  poseRotation(index: number): Quaternion {
    return this.bones[index]?.rotation ?? QUATERNION_IDENTITY;
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
    return this.bindMatrices(this.rig.automaticBindings);
  }

  /**
   * The bone each bind of a Skin moves with (`skeleton_3d.cpp:363-396`): the first bone of its name,
   * else the bone at its index. A name no bone carries, an index past the last bone, and a bind with
   * neither all take bone 0, and each reports to `onUnresolved` as Godot prints an error.
   */
  resolveBinds(binds: readonly SkinBind[], onUnresolved: (message: string) => void): SkinBinding[] {
    return binds.map(({ bone, name, pose }, index) => {
      if (name !== '') {
        const found = this.findBone(name);
        if (found < 0)
          onUnresolved(`Skin bind #${index} names the bone "${name}", which the Skeleton3D lacks`);
        return { bone: Math.max(found, 0), pose };
      }
      if (bone < 0) onUnresolved(`Skin bind #${index} has neither a name nor a bone index`);
      else if (bone >= this.boneCount)
        onUnresolved(`Skin bind #${index} names bone ${bone}, past the bone count ${this.boneCount}`);
      return { bone: bone >= 0 && bone < this.boneCount ? bone : 0, pose };
    });
  }

  /** The matrix of every bind: the global pose of its bone times its bind pose (`:398-403`). */
  bindMatrices(bindings: readonly SkinBinding[]): Transform3D[] {
    const globals = this.globals();
    return bindings.map(({ bone, pose }) => {
      const global = globals[bone];
      return global ? multiplyTransform3D(global, pose) : COLLAPSED_BIND_MATRIX;
    });
  }

  private write(index: number, change: Partial<Pick<Bone, 'position' | 'rotation' | 'scale'>>): void {
    const bone = this.bones[index];
    if (!bone) return;
    this.bones[index] = { ...bone, ...change };
    this.cache = undefined;
  }

  private globals(): Transform3D[] {
    if (this.cache) return this.cache;
    const poses = this.bones.map(identityTransform3D);
    for (const index of this.rig.order) {
      const bone = this.bones[index]!;
      const parent = parentOf(bone, this.bones.length);
      const isPosed = bone.enabled && !this.showRestOnly;
      poses[index] = standOn(parent < 0 ? null : poses[parent]!, isPosed ? poseOf(bone) : bone.rest);
    }
    this.cache = poses;
    return poses;
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
