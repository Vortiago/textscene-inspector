/**
 * The bones of a Skeleton2D while its modification stack runs, each one a Node2D as the solvers use
 * it: a local transform, the rotation and scale `Node2D` keeps beside it, and the global transform
 * its parent chain gives. Each value is a `real_t` float, since a chain that folds onto one line
 * bends to the side a rounding picks.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DFromParts,
  transform2DDecompose,
  transform2DGetRotation,
  transform2DGetScale,
  transform2DOrigin,
  transform2DSetRotation,
  transform2DXform,
  type Transform2DColumns,
} from '../../../../godot/math/transform2d.js';
import { atan2Real } from '../../../../godot/math/realAtan2.js';
import { storedReal as f } from '../../../../godot/math/real.js';
import type { Vector2 } from '../../../../godot/math/vector.js';
import type { OutsideBone, StackBone, StackPlacement } from './stackScene';

/** The values `Node2D::_update_xform_values` reads from a transform (`node_2d.cpp:127-133`). */
type XformValues = ReturnType<typeof transform2DDecompose>;

export class StackPose {
  /** The bones of the skeleton by index, then each outside bone. */
  private readonly bones: readonly Pick<StackBone, 'length' | 'boneAngle'>[];
  private readonly transforms: Transform2DColumns[];
  /** Null while the values are stale: `set_transform` marks them dirty (`node_2d.cpp:374`). */
  private readonly values: (XformValues | null)[];
  /** Null for a bone whose global transform no read made since a bone last moved. */
  private readonly globals: (Transform2DColumns | null)[];

  constructor(
    private readonly skeletonGlobal: Transform2DColumns,
    private readonly ownBones: readonly StackBone[],
    locals: readonly Transform2DColumns[],
    private readonly outsideBones: readonly OutsideBone[] = []
  ) {
    this.bones = [...ownBones, ...outsideBones];
    this.transforms = [...locals, ...outsideBones.map(({ local }) => local)];
    this.values = this.transforms.map(() => null);
    this.globals = this.transforms.map(() => null);
  }

  /** `Skeleton2D::get_bone` (`skeleton_2d.cpp:624-628`): whether `bone` indexes a bone of the skeleton. */
  has(bone: number): boolean {
    return bone >= 0 && bone < this.ownBones.length;
  }

  /** The index a bone outside the skeleton has in this pose, past the bones of the skeleton. */
  indexOfOutside(bone: OutsideBone): number {
    return this.ownBones.length + this.outsideBones.indexOf(bone);
  }

  bone(bone: number): Pick<StackBone, 'length' | 'boneAngle'> {
    return this.bones[bone]!;
  }

  /** A copy of each local transform, by bone index, then of each outside bone. */
  locals(): Transform2DColumns[] {
    return [...this.transforms];
  }

  transform(bone: number): Transform2DColumns {
    return this.transforms[bone]!;
  }

  setTransform(bone: number, transform: Transform2DColumns): void {
    this.transforms[bone] = transform;
    this.values[bone] = null;
    this.globals.fill(null);
  }

  /** `Node2D::get_rotation`: the stored value, which `set_rotation` does not wrap. */
  rotation(bone: number): number {
    return this.valuesOf(bone).rotation;
  }

  /** `Node2D::set_rotation` (`node_2d.cpp:164-171`): the transform rebuilt from the stored values. */
  setRotation(bone: number, rotation: number): void {
    const values = { ...this.valuesOf(bone), rotation };
    this.transforms[bone] = transform2DFromParts(rotation, values.scale, values.skew, values.position);
    this.values[bone] = values;
    this.globals.fill(null);
  }

  /** `Node2D::rotate` (`node_2d.cpp:249-252`). */
  rotate(bone: number, radians: number): void {
    this.setRotation(bone, f(this.rotation(bone) + radians));
  }

  globalTransform(bone: number): Transform2DColumns {
    return (this.globals[bone] ??= multiplyTransform2D(this.parentGlobal(bone), this.transforms[bone]!));
  }

  globalPosition(bone: number): Vector2 {
    return transform2DOrigin(this.globalTransform(bone));
  }

  globalRotation(bone: number): number {
    return transform2DGetRotation(this.globalTransform(bone));
  }

  /** `Node2D::get_global_scale` (`node_2d.cpp:353-356`). */
  globalScale(bone: number): Vector2 {
    return transform2DGetScale(this.globalTransform(bone));
  }

  /** `Node2D::set_global_rotation` (`node_2d.cpp:320-332`). */
  setGlobalRotation(bone: number, radians: number): void {
    const parentGlobal = this.parentGlobal(bone);
    const turned = transform2DSetRotation(multiplyTransform2D(parentGlobal, this.transforms[bone]!), radians);
    const local = multiplyTransform2D(affineInverseTransform2D(parentGlobal), turned);
    this.setRotation(bone, transform2DGetRotation(local));
  }

  /** `Node2D::set_global_transform` (`node_2d.cpp:384-392`). */
  setGlobalTransform(bone: number, transform: Transform2DColumns): void {
    this.setTransform(
      bone,
      multiplyTransform2D(affineInverseTransform2D(this.parentGlobal(bone)), transform)
    );
  }

  /** `Node2D::get_angle_to` (`node_2d.cpp:415-418`). */
  angleTo(bone: number, point: Vector2): number {
    const local = transform2DXform(affineInverseTransform2D(this.globalTransform(bone)), point);
    const { scale } = this.valuesOf(bone);
    return atan2Real(f(local.y * scale.y), f(local.x * scale.x));
  }

  /** The global transform of a node at `placement`, which moves with the bone that carries it. */
  placed(placement: StackPlacement): Transform2DColumns {
    if (placement.outsideBone) {
      const carrier = this.globalTransform(this.indexOfOutside(placement.outsideBone));
      return multiplyTransform2D(carrier, placement.offset);
    }
    if (placement.carrier < 0) return placement.offset;
    return multiplyTransform2D(this.globalTransform(placement.carrier), placement.offset);
  }

  private parentGlobal(bone: number): Transform2DColumns {
    if (bone >= this.ownBones.length) return this.outsideParentGlobal(bone);
    const { parent } = this.ownBones[bone]!;
    return parent < 0 ? this.skeletonGlobal : this.globalTransform(parent);
  }

  private outsideParentGlobal(bone: number): Transform2DColumns {
    return this.placed(this.outsideBones[bone - this.ownBones.length]!.parent);
  }

  private valuesOf(bone: number): XformValues {
    return (this.values[bone] ??= transform2DDecompose(this.transforms[bone]!));
  }
}
