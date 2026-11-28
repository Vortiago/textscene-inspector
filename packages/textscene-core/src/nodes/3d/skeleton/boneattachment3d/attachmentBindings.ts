import { nodePathLiteral } from '../../../../godot/variant/variantParser.js';
import { parentPathOf, pathBetween } from '../../../../utils/nodePath.js';
import { perObject } from '../../../../utils/perObject.js';
import type { Transform3D } from '../../../../godot/math/transform3d.js';
import type { LiveLink, LiveTree } from '../../../../r3f/liveSceneTree.js';
import { resolveLiteralOnLiveTree } from '../../../../r3f/nodePathUniqueNames.js';
import { attachmentLoad, compareLoadOrder } from './attachmentLoadOrder.js';
import { LoadedSkeletonPose, type LoadedPose } from './loadedSkeletonPose.js';
import type { AttachmentSettings, AttachmentWrite, BoneAttachment3DProperties } from './types.js';
import type { Skeleton3DProperties } from '../../skeleton3d/types.js';

interface AttachmentBinding {
  skeleton: LiveLink | null;
  bone: number | string;
  external: boolean;
  heldLocal?: Transform3D;
}

type Load = ReturnType<typeof attachmentLoad>;

export function scenePose(skeleton: LiveLink, tree: LiveTree): LoadedPose | undefined {
  return attachmentBindings(tree).poses.get(skeleton.path);
}

class Attachment {
  private readonly state: AttachmentSettings;
  private heldLocal?: Transform3D;
  private bound = false;
  private cachedExternal: LiveLink | null = null;
  readonly layers;

  constructor(
    private readonly link: LiveLink,
    private readonly tree: LiveTree,
    private readonly poses: (skeleton: LiveLink) => LoadedSkeletonPose,
    private readonly attachments: ReadonlyMap<string, Attachment>
  ) {
    const properties = link.step.node.properties as BoneAttachment3DProperties;
    this.state = { ...(properties.bindingOverrides?.base ?? properties) };
    this.layers = properties.bindingOverrides?.layers ?? [];
  }

  write(write: AttachmentWrite, load: Load): void {
    const skeleton = () => {
      const link = this.skeleton(load);
      return link && load.canReach(link) ? this.poses(link) : null;
    };
    switch (write.key) {
      case 'transform':
        this.heldLocal = undefined;
        break;
      case 'boneName': {
        this.state.boneName = write.value;
        const rig = skeleton();
        if (rig) this.setIndex(rig.findBone(write.value), rig);
        break;
      }
      case 'boneIdx':
        this.setIndex(write.value, skeleton());
        break;
      case 'overridePose':
        // bone_attachment_3d.cpp:220-233
        if (this.state.overridePose && !write.value && this.state.boneIdx >= 0)
          skeleton()?.reset(this.state.boneIdx);
        this.state.overridePose = write.value;
        break;
      case 'externalSkeleton':
        this.state.externalSkeleton = write.value;
        this.updateExternal(load);
        break;
      case 'useExternalSkeleton':
        this.state.useExternalSkeleton = write.value;
        if (write.value) {
          const external = this.updateExternal(load);
          const rig = external && load.canReach(external) ? this.poses(external) : null;
          if (rig && this.state.boneIdx < 0) this.state.boneIdx = rig.findBone(this.state.boneName);
          this.bound = !!rig && this.state.boneIdx >= 0;
        }
        break;
    }
  }

  result(): AttachmentBinding {
    const skeleton = this.state.useExternalSkeleton ? this.updateExternal() : this.skeleton();
    const bone = !this.bound && this.state.boneIdx < 0 ? this.state.boneName : this.state.boneIdx;
    return {
      skeleton,
      bone: this.state.overridePose ? -1 : bone,
      external: this.state.useExternalSkeleton,
      heldLocal: this.heldLocal,
    };
  }

  private skeleton(load?: Load): LiveLink | null {
    if (this.state.useExternalSkeleton) return this.cachedExternal ?? this.updateExternal(load);
    const parent = this.parent(load);
    return parent?.step.node.type === 'Skeleton3D' ? parent : null;
  }

  private parent(load?: Load): LiveLink | null {
    const path = parentPathOf(this.link.path);
    const link = path ? this.tree.at(path) : null;
    return link && (!load || load.canReach(link)) ? link : null;
  }

  private updateExternal(load?: Load): LiveLink | null {
    const literal = this.state.externalSkeleton;
    if (pathTextOf(literal) !== '') {
      const boundary = load
        ? { depth: load.depth, exists: (path: string) => load.exists(path) }
        : { depth: 1, exists: (path: string) => !!this.tree.at(path) };
      const path = resolveLiteralOnLiveTree(this.link.path, literal, this.tree, boundary);
      const target = path ? this.tree.at(path) : null;
      this.cachedExternal = target?.step.node.type === 'Skeleton3D' ? target : null;
    } else {
      const parent = this.parent(load);
      this.cachedExternal = parent ? (this.attachments.get(parent.path)?.updateExternal(load) ?? null) : null;
      // bone_attachment_3d.cpp:93-107
      if (this.cachedExternal)
        this.state.externalSkeleton = pathBetween(this.link.path, this.cachedExternal.path);
    }
    return this.cachedExternal;
  }

  private setIndex(index: number, rig: LoadedSkeletonPose | null): void {
    this.state.boneIdx = index;
    if (!rig) return;
    // bone_attachment_3d.cpp:190-211
    const name = rig.nameAt(index);
    if (name === undefined) {
      this.state.boneIdx = -1;
      return;
    }
    this.state.boneName = name;
    if (!this.state.useExternalSkeleton && !this.state.overridePose) this.heldLocal = rig.globalPose(index);
  }
}

export const attachmentBindings = perObject((tree: LiveTree) => {
  const attachments = new Map<string, Attachment>();
  const loading = new Map<string, LoadedSkeletonPose>();
  const rigAt = (skeleton: LiveLink) => {
    const previous = loading.get(skeleton.path);
    if (previous) return previous;
    const rig = new LoadedSkeletonPose(skeleton);
    loading.set(skeleton.path, rig);
    return rig;
  };
  const pending: { order: readonly number[]; apply(): void }[] = [];
  tree.fold<void, void>(undefined, (link, _, descend) => {
    if (link.step.node.type === 'BoneAttachment3D') {
      const target = new Attachment(link, tree, rigAt, attachments);
      attachments.set(link.path, target);
      for (const layer of target.layers) {
        const load = attachmentLoad(link, tree, layer);
        pending.push({
          order: load.order,
          apply() {
            for (const write of layer.writes) target.write(write, load);
          },
        });
      }
    } else if (link.step.node.type === 'Skeleton3D') {
      const history = (link.step.node.properties as Skeleton3DProperties).poseOverrides;
      for (const layer of history?.layers ?? []) {
        const load = attachmentLoad(link, tree, layer);
        pending.push({
          order: load.order,
          apply() {
            rigAt(link).apply(layer);
          },
        });
      }
    }
    descend();
  });
  pending.sort((a, b) => compareLoadOrder(a.order, b.order));
  for (const step of pending) step.apply();
  const bindings = new Map<string, AttachmentBinding>();
  for (const [path, target] of attachments) bindings.set(path, target.result());
  const poses = new Map<string, LoadedPose>();
  for (const [path, rig] of loading) {
    const pose = rig.result();
    if (pose) poses.set(path, pose);
  }
  return { bindings, poses };
});

function pathTextOf(literal: string | undefined): string {
  if (literal === undefined) return '';
  return nodePathLiteral(literal) ?? literal.trim();
}
