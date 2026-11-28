import type { LiveLink } from '../../../../r3f/liveSceneTree.js';
import {
  decomposeTransform3D,
  sameTransform3D,
  sameVector3,
  type Transform3D,
} from '../../../../godot/math/transform3d.js';
import { perObject } from '../../../../utils/perObject.js';
import { sameElements } from '../../../../utils/sameElements.js';
import { BonePoses, type Bone } from '../../skeleton3d/skeletonPose.js';
import type { Skeleton3DProperties, SkeletonLayer } from '../../skeleton3d/types.js';

export interface LoadedPose {
  bones: readonly Bone[];
  globals?: ReadonlyMap<number, Transform3D>;
}

const unchangedPose = perObject((bones: readonly Bone[]): LoadedPose => ({ bones }));
const kept = perObject(() => new Map<string, LoadedPose>());

export function originalPose(link: LiveLink): LoadedPose {
  return unchangedPose((link.step.node.properties as Skeleton3DProperties).bones);
}

export class LoadedSkeletonPose {
  private readonly bones: Bone[];
  private hasReset = false;
  private readonly globals = new Map<number, Transform3D>();
  private poses: BonePoses;
  private showRestOnly: boolean;
  private applied = false;

  constructor(private readonly skeleton: LiveLink) {
    const properties = skeleton.step.node.properties as Skeleton3DProperties;
    const { bones, showRestOnly } = properties.poseOverrides?.base ?? properties;
    this.showRestOnly = showRestOnly;
    this.bones = [...bones];
    this.poses = new BonePoses(bones, showRestOnly, undefined, this.globals);
  }

  apply(layer: SkeletonLayer): void {
    for (const { index, change } of layer.changes) {
      if (change.name !== undefined || change.parent !== undefined) this.globals.clear();
      else if (change.rest !== undefined || change.enabled !== undefined) {
        this.poses.forgetGlobalSubtree(index, this.globals);
      }
      this.bones[index] = { ...this.bones[index]!, ...change };
    }
    if (layer.showRestOnly !== undefined) {
      this.globals.clear();
      this.showRestOnly = layer.showRestOnly;
    }
    this.applied = true;
    this.poses = new BonePoses(this.bones, this.showRestOnly, undefined, this.globals);
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
    this.hasReset = true;
    // skeleton_3d.cpp:856-888,908-914
    this.bones[index] = { ...bone, position: bone.rest.origin, ...decomposeTransform3D(bone.rest) };
    this.poses.setPose(index, bone.rest);
    this.poses.retainGlobals(this.globals);
  }

  result(): LoadedPose {
    if (!this.hasReset && (!this.applied || !this.globals.size)) return originalPose(this.skeleton);
    const cached = kept(this.skeleton.step.node);
    const last = cached.get(this.skeleton.path);
    if (
      last &&
      sameElements(this.bones, last.bones, sameLocalPose) &&
      sameGlobals(this.globals, last.globals)
    )
      return last;
    const pose = { bones: this.bones, globals: this.globals };
    cached.set(this.skeleton.path, pose);
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

function sameLocalPose(a: Bone, b: Bone): boolean {
  return (
    a === b ||
    (sameVector3(a.position, b.position) &&
      sameVector3(a.rotation, b.rotation) &&
      a.rotation.w === b.rotation.w &&
      sameVector3(a.scale, b.scale))
  );
}
