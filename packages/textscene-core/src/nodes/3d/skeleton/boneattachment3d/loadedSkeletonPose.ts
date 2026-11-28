import type { LiveLink } from '../../../../r3f/liveSceneTree.js';
import {
  decomposeTransform3D,
  sameTransform3D,
  type Transform3D,
} from '../../../../godot/math/transform3d.js';
import { perObject } from '../../../../utils/perObject.js';
import { sameElements } from '../../../../utils/sameElements.js';
import { BonePoses, type Bone } from '../../skeleton3d/skeletonPose.js';
import type { Skeleton3DProperties } from '../../skeleton3d/types.js';

export interface LoadedPose {
  bones: readonly Bone[];
  globals?: ReadonlyMap<number, Transform3D>;
}

const unchangedPose = perObject((bones: readonly Bone[]): LoadedPose => ({ bones }));
const kept = perObject(() => new Map<string, { indices: number[]; pose: LoadedPose }>());

export function originalPose(link: LiveLink): LoadedPose {
  return unchangedPose((link.step.node.properties as Skeleton3DProperties).bones);
}

export class LoadedSkeletonPose {
  private readonly bones: Bone[];
  private readonly indices = new Set<number>();
  private readonly globals = new Map<number, Transform3D>();
  private readonly poses: BonePoses;

  constructor(private readonly skeleton: LiveLink) {
    const { bones, showRestOnly } = skeleton.step.node.properties as Skeleton3DProperties;
    this.bones = [...bones];
    this.poses = new BonePoses(bones, showRestOnly, undefined, this.globals);
  }

  findBone(name: string): number {
    return this.poses.findBone(name);
  }

  nameAt(index: number): string | undefined {
    return this.bones[index]?.name;
  }

  globalPose(index: number): Transform3D {
    const pose = this.poses.globalPose(index);
    // skeleton_3d.cpp:532-563
    for (let bone = index; bone >= 0 && !this.globals.has(bone); bone = this.poses.parentOf(bone)) {
      this.globals.set(bone, this.poses.globalPose(bone));
    }
    return pose;
  }

  reset(index: number): void {
    const bone = this.bones[index];
    if (!bone) return;
    this.indices.add(index);
    // skeleton_3d.cpp:856-888,908-914
    this.bones[index] = { ...bone, position: bone.rest.origin, ...decomposeTransform3D(bone.rest) };
    this.poses.setPose(index, bone.rest);
    this.poses.retainGlobals(this.globals);
  }

  result(): LoadedPose {
    if (!this.indices.size) return originalPose(this.skeleton);
    const indices = [...this.indices];
    const cached = kept(this.skeleton.step.node);
    const last = cached.get(this.skeleton.path);
    if (last && sameElements(indices, last.indices) && sameGlobals(this.globals, last.pose.globals))
      return last.pose;
    const pose = { bones: this.bones, globals: this.globals };
    cached.set(this.skeleton.path, { indices, pose });
    return pose;
  }
}

function sameGlobals(
  globals: ReadonlyMap<number, Transform3D>,
  other?: ReadonlyMap<number, Transform3D>
): boolean {
  if (globals.size !== other?.size) return false;
  for (const [bone, pose] of globals) {
    const previous = other.get(bone);
    if (!previous || !sameTransform3D(pose, previous)) return false;
  }
  return true;
}
