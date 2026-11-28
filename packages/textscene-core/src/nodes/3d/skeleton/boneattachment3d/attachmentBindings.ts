import { nodePathLiteral } from '../../../../godot/variant/variantParser.js';
import { parentPathOf } from '../../../../utils/nodePath.js';
import { perObject } from '../../../../utils/perObject.js';
import type { Transform3D } from '../../../../godot/math/transform3d.js';
import type { LiveLink, LiveTree } from '../../../../r3f/liveSceneTree.js';
import { resolveLiteralOnLiveTree } from '../../../../r3f/nodePathUniqueNames.js';
import { attachmentLoad, compareLoadOrder } from './attachmentLoadOrder.js';
import { LoadedSkeletonPose, originalPose, type LoadedPose } from './loadedSkeletonPose.js';
import type { AttachmentSettings, AttachmentWrite, BoneAttachment3DProperties } from './types.js';
import type { Skeleton3DProperties } from '../../skeleton3d/types.js';

interface AttachmentBinding {
  skeleton: LiveLink | null;
  bone: number;
  external: boolean;
  heldLocal?: Transform3D;
}

type Load = ReturnType<typeof attachmentLoad>;

export function scenePose(skeleton: LiveLink, tree: LiveTree): LoadedPose {
  return attachmentBindings(tree).poses.get(skeleton.path) ?? originalPose(skeleton);
}

class Attachment {
  private readonly state: AttachmentSettings;
  private heldLocal?: Transform3D;
  private bound = false;
  readonly layers;

  constructor(
    private readonly link: LiveLink,
    private readonly tree: LiveTree,
    private readonly poses: (skeleton: LiveLink) => LoadedSkeletonPose
  ) {
    const properties = link.step.node.properties as BoneAttachment3DProperties;
    this.state = { ...(properties.bindingOverrides?.base ?? properties) };
    this.layers = properties.bindingOverrides?.layers ?? [];
  }

  write(write: AttachmentWrite, load: Load): void {
    const skeleton = () => {
      const link = skeletonOf(this.state, this.link.path, this.tree);
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
        break;
      case 'useExternalSkeleton':
        this.state.useExternalSkeleton = write.value;
        if (write.value) {
          const rig = skeleton();
          if (rig && this.state.boneIdx < 0) this.state.boneIdx = rig.findBone(this.state.boneName);
          this.bound = !!rig && this.state.boneIdx >= 0;
        }
        break;
    }
  }

  result(): AttachmentBinding {
    const skeleton = skeletonOf(this.state, this.link.path, this.tree);
    let bone = this.state.boneIdx;
    if (skeleton && !this.bound && bone < 0) {
      const { bones } = skeleton.step.node.properties as Skeleton3DProperties;
      bone = bones.findIndex((entry) => entry.name === this.state.boneName);
    }
    return {
      skeleton,
      bone: this.state.overridePose ? -1 : bone,
      external: this.state.useExternalSkeleton,
      heldLocal: this.heldLocal,
    };
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
  const pending: { target: Attachment; load: Load; writes: readonly AttachmentWrite[] }[] = [];
  tree.fold<void, void>(undefined, (link, _, descend) => {
    if (link.step.node.type === 'BoneAttachment3D') {
      const target = new Attachment(link, tree, rigAt);
      attachments.set(link.path, target);
      for (const layer of target.layers)
        pending.push({ target, load: attachmentLoad(link, tree, layer), writes: layer.writes });
    }
    descend();
  });
  pending.sort((a, b) => compareLoadOrder(a.load.order, b.load.order));
  for (const { target, load, writes } of pending) {
    for (const write of writes) target.write(write, load);
  }
  const bindings = new Map<string, AttachmentBinding>();
  for (const [path, target] of attachments) bindings.set(path, target.result());
  const poses = new Map<string, LoadedPose>();
  for (const [path, rig] of loading) poses.set(path, rig.result());
  return { bindings, poses };
});

function skeletonOf(properties: AttachmentSettings, path: string, tree: LiveTree): LiveLink | null {
  if (!properties.useExternalSkeleton) {
    const parentPath = parentPathOf(path);
    const parent = parentPath ? tree.at(parentPath) : null;
    return parent?.step.node.type === 'Skeleton3D' ? parent : null;
  }
  if (pathTextOf(properties.externalSkeleton) !== '') {
    const skeleton = skeletonAt(path, properties.externalSkeleton!, tree);
    return skeleton;
  }
  for (let parentPath = parentPathOf(path); parentPath; parentPath = parentPathOf(parentPath)) {
    const parent = tree.at(parentPath);
    if (parent?.step.node.type !== 'BoneAttachment3D') return null;
    const inherited = parent.step.node.properties as BoneAttachment3DProperties;
    if (pathTextOf(inherited.externalSkeleton) !== '') {
      return skeletonAt(parent.path, inherited.externalSkeleton!, tree);
    }
  }
  return null;
}

function skeletonAt(from: string, literal: string, tree: LiveTree): LiveLink | null {
  const resolved = resolveLiteralOnLiveTree(from, literal, tree);
  const skeleton = resolved === null ? null : tree.at(resolved);
  return skeleton?.step.node.type === 'Skeleton3D' ? skeleton : null;
}

function pathTextOf(literal: string | undefined): string {
  if (literal === undefined) return '';
  return nodePathLiteral(literal) ?? literal.trim();
}
