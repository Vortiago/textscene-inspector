/**
 * The node tree Godot 4.6.3's glTF importer builds below the scene root, ported from
 * `_generate_scene_node` and its helpers (`gltf_document.cpp:4488-4864`, `:5888-5922`). A scene's
 * node path into an instanced glTF names these nodes, among them the Skeleton3D and BoneAttachment3D.
 */

import { serialChildName } from '../string/nodeName.js';

/** A glTF node as the scene builder reads it. -1 means none. */
export interface GltfSceneSourceNode {
  /** The node name, or for a bone the bone name. */
  readonly name: string;
  readonly children: readonly number[];
  readonly parent: number;
  /** Set for each skin joint and each node a skeleton absorbs. */
  readonly joint: boolean;
  readonly mesh: number;
  readonly skin: number;
  readonly camera: number;
  readonly light: number;
}

export interface GltfSceneSource {
  readonly nodes: readonly GltfSceneSourceNode[];
  /** The loaded scene's root nodes. Before 4.5, every parentless node. */
  readonly rootNodes: readonly number[];
  /** The bones of each skeleton, as glTF node indexes. */
  readonly skeletons: readonly (readonly number[])[];
  /** The skeleton index of each skin. */
  readonly skinSkeletons: readonly number[];
  /** `GODOT_single_root`: glTF node 0 is the scene root. */
  readonly singleRoot: boolean;
  /** `gltf/naming_version`. 0 and 1 build the tree as Godot 4.4 did. */
  readonly namingVersion: number;
  /** Whether the importer adds an AnimationPlayer. */
  readonly hasAnimations: boolean;
}

/**
 * What a node of the imported scene is. A `node` is a glTF node's Node3D, MeshInstance3D, Camera3D or
 * light, or the Node3D that holds a skinned mesh's children.
 */
export type GltfSceneNodeKind = 'node' | 'skeleton' | 'boneAttachment' | 'animationPlayer';

export interface GltfSceneNode {
  /** The path below the scene root, as `Node::get_path_to` gives it. */
  path: string;
  kind: GltfSceneNodeKind;
  /**
   * A `node` or `boneAttachment`'s glTF node, which for a BoneAttachment3D is its bone. A
   * Skeleton3D's is the glTF node that put it in the tree. -1 for an AnimationPlayer.
   */
  gltfNode: number;
}

const ANIMATION_PLAYER_NAME = 'AnimationPlayer';
const SKELETON_NAME = 'Skeleton3D';

interface SceneNode {
  name: string;
  kind: GltfSceneNodeKind;
  gltfNode: number;
  /** Whether Godot makes it an ImporterMeshInstance3D, which a skinned mesh is. */
  isMeshInstance: boolean;
  parent: SceneNode | null;
  /** In the order Godot lists them. A Set removes a moved child without a scan of its siblings. */
  readonly children: Set<SceneNode>;
  /** The names of `children`, which `addChild` checks for a taken name. */
  readonly childNames: Set<string>;
}

function sceneNode(
  name: string,
  kind: GltfSceneNodeKind,
  gltfNode: number,
  isMeshInstance = false
): SceneNode {
  return { name, kind, gltfNode, isMeshInstance, parent: null, children: new Set(), childNames: new Set() };
}

/** `Node::add_child(child, true)`: a taken name takes a number (`node.cpp:1593-1640`). */
function addChild(parent: SceneNode, child: SceneNode): void {
  child.name = serialChildName(child.name, parent.childNames);
  child.parent = parent;
  parent.children.add(child);
  parent.childNames.add(child.name);
}

function removeFromParent(node: SceneNode): void {
  node.parent?.children.delete(node);
  node.parent?.childNames.delete(node.name);
  node.parent = null;
}

/** Builds the scene one source describes. */
class SceneBuilder {
  /** `_create_skeletons` makes every Skeleton3D before it makes the tree (`skin_tool.cpp:574-579`). */
  private readonly skeletons: SceneNode[];
  /** The Skeleton3D each bone belongs to. */
  private readonly skeletonByBone = new Map<number, SceneNode>();
  /** `scene_nodes`: the Godot node each glTF node stands for. A bone starts as its Skeleton3D (`skin_tool.cpp:649`). */
  private readonly sceneNodes = new Map<number, SceneNode>();
  /** `scene_mesh_instances`. */
  private readonly meshInstances = new Map<number, SceneNode>();

  constructor(private readonly source: GltfSceneSource) {
    this.skeletons = source.skeletons.map((bones) => {
      const node = sceneNode(SKELETON_NAME, 'skeleton', -1);
      for (const bone of bones) {
        this.skeletonByBone.set(bone, node);
        this.sceneNodes.set(bone, node);
      }
      return node;
    });
  }

  /** The Skeleton3D of the skeleton `index` is a bone of, or undefined for a node that is no bone. */
  private skeletonOf(index: number): SceneNode | undefined {
    return this.skeletonByBone.get(index);
  }

  /** The scene root, or null where the glTF has no node to put in it. */
  build(): SceneNode | null {
    const { nodes, rootNodes, singleRoot, namingVersion } = this.source;
    const generate = (index: number, parent: SceneNode | null, root: SceneNode | null): void =>
      namingVersion < 2 ? this.generateCompat(index, parent, root) : this.generate(index, parent, root);
    let root: SceneNode | null;
    if (singleRoot) {
      if (nodes.length === 0) return null;
      generate(0, null, null);
      root = this.sceneNodes.get(0) ?? null;
      while (root?.parent) root = root.parent;
    } else {
      root = sceneNode('', 'node', -1);
      for (const rootNode of rootNodes) generate(rootNode, root, root);
    }
    if (root === null) return null;
    this.moveSkinnedMeshesToSkeletons();
    if (this.source.hasAnimations) addChild(root, sceneNode(ANIMATION_PLAYER_NAME, 'animationPlayer', -1));
    return root;
  }

  private spatial(index: number): SceneNode {
    return sceneNode('', 'node', index);
  }

  private meshInstance(index: number): SceneNode {
    const node = sceneNode('', 'node', index, true);
    this.meshInstances.set(index, node);
    return node;
  }

  /** The node `_generate_scene_node` builds for a glTF node that holds a mesh, a camera or a light. */
  private contentNode(index: number): SceneNode | null {
    const { mesh, camera, light } = this.source.nodes[index]!;
    if (mesh >= 0) return this.meshInstance(index);
    return camera >= 0 || light >= 0 ? this.spatial(index) : null;
  }

  /** `_does_skinned_mesh_require_placeholder_node` (`gltf_document.cpp:4488-4508`). */
  private needsPlaceholder(index: number): boolean {
    const { nodes } = this.source;
    if (nodes[index]!.skin < 0) return false;
    return nodes[index]!.children.some(
      (child) => !nodes[child]!.joint || this.skeletonOf(child)?.parent === null
    );
  }

  /** `_generate_scene_node` (`gltf_document.cpp:4510-4594`). */
  private generate(index: number, parent: SceneNode | null, root: SceneNode | null): void {
    const gltf = this.source.nodes[index]!;
    let current = this.contentNode(index);
    if (current?.isMeshInstance && this.needsPlaceholder(index)) {
      // The Skeleton3D is the placeholder when it is not yet in the tree.
      const skeleton = this.skeletonOf(index);
      const placeholder = skeleton?.parent === null ? skeleton : this.spatial(index);
      current.name = gltf.name;
      addChild(placeholder, current);
      current = placeholder;
    }
    if (current?.kind !== 'skeleton') {
      if (current) current.name = gltf.name;
      if (this.skeletonOf(index)) {
        this.generateSkeletonBone(index, current, parent, root);
        return;
      }
    }
    if (parent?.kind === 'skeleton') {
      this.attachToSkeleton(index, current, parent, root);
      return;
    }
    if (!current) {
      current = this.spatial(index);
      current.name = gltf.name;
    } else if (current.kind === 'skeleton') {
      current.gltfNode = index;
    }
    if (parent) addChild(parent, current);
    root ??= current;
    this.sceneNodes.set(index, current);
    for (const child of gltf.children) this.generate(child, current, root);
  }

  /** `_generate_skeleton_bone_node` (`gltf_document.cpp:4596-4616`). */
  private generateSkeletonBone(
    index: number,
    current: SceneNode | null,
    parent: SceneNode | null,
    root: SceneNode | null
  ): void {
    const skeleton = this.skeletonOf(index)!;
    if (skeleton.parent === null) {
      if (!root) {
        root = skeleton;
      } else if (parent?.kind === 'skeleton') {
        // The root Skeleton3D has no parent to hold its own bones (`:4620`), so the import stops here.
        return;
      } else {
        skeleton.gltfNode = index;
        addChild(parent!, skeleton);
      }
    }
    this.attachToSkeleton(index, current, skeleton, root);
  }

  /** `_attach_node_to_skeleton` (`gltf_document.cpp:4618-4663`). */
  private attachToSkeleton(
    index: number,
    current: SceneNode | null,
    skeleton: SceneNode,
    root: SceneNode | null
  ): void {
    // `ERR_FAIL_NULL` (`gltf_document.cpp:4620`): a Skeleton3D that is the scene root attaches nothing.
    if (skeleton.parent === null) return;
    const gltf = this.source.nodes[index]!;
    if (current?.isMeshInstance && gltf.skin >= 0) {
      // A skinned mesh sits straight under its Skeleton3D, without a BoneAttachment3D.
      addChild(skeleton, current);
    } else if (current || !gltf.joint) {
      const boneIndex = gltf.joint ? index : gltf.parent;
      let holder = this.sceneNodes.get(boneIndex);
      if (!holder) return;
      if (holder.kind === 'skeleton')
        holder = this.boneAttachment(skeleton, boneIndex, this.source.nodes[boneIndex]!.name);
      current ??= this.spatial(index);
      current.name = gltf.name;
      addChild(holder, current);
    } else {
      // A plain joint is only a bone of the Skeleton3D.
      current = skeleton;
    }
    this.sceneNodes.set(index, current);
    for (const child of gltf.children) this.generate(child, current, root);
  }

  /** A BoneAttachment3D under `skeleton`, which stands for the glTF node `boneIndex` from then on. */
  private boneAttachment(skeleton: SceneNode, boneIndex: number, name: string): SceneNode {
    const attachment = sceneNode(name, 'boneAttachment', boneIndex);
    addChild(skeleton, attachment);
    this.sceneNodes.set(boneIndex, attachment);
    return attachment;
  }

  /** `_generate_scene_node_compat_4pt4` (`gltf_document.cpp:4666-4763`). */
  private generateCompat(index: number, parent: SceneNode | null, root: SceneNode | null): void {
    const gltf = this.source.nodes[index]!;
    if (this.skeletonOf(index)) {
      this.generateSkeletonBoneCompat(index, parent, root);
      return;
    }
    let holder = parent;
    if (parent?.kind === 'skeleton' && gltf.skin < 0) {
      // A node under a bone sits in a BoneAttachment3D of its own name.
      holder = sceneNode(gltf.name, 'boneAttachment', gltf.parent);
      addChild(parent, holder);
    }
    let current: SceneNode;
    if (gltf.skin >= 0 && gltf.mesh >= 0 && gltf.children.length > 0) {
      // The skinned mesh moves to its skeleton later, so a Node3D keeps the children in place.
      current = this.spatial(index);
      const mesh = this.meshInstance(index);
      mesh.name = gltf.name;
      addChild(current, mesh);
    } else {
      current = this.contentNode(index) ?? this.spatial(index);
    }
    current.name = gltf.name;
    if (root) addChild(holder!, current);
    this.sceneNodes.set(index, current);
    for (const child of gltf.children) this.generateCompat(child, current, root ?? current);
  }

  /** `_generate_skeleton_bone_node_compat_4pt4` (`gltf_document.cpp:4766-4864`). */
  private generateSkeletonBoneCompat(index: number, parent: SceneNode | null, root: SceneNode | null): void {
    const gltf = this.source.nodes[index]!;
    const skeleton = this.skeletonOf(index)!;
    if (parent !== skeleton && skeleton.parent === null) {
      if (root && parent) {
        skeleton.gltfNode = index;
        addChild(parent, skeleton);
      } else {
        root = skeleton;
      }
    }
    let current = skeleton;
    if (gltf.mesh >= 0 || gltf.camera >= 0 || gltf.light >= 0) {
      const content = this.contentNode(index)!;
      content.name = gltf.name;
      const isSkinned = gltf.skin >= 0 && gltf.mesh >= 0;
      // A skinned mesh sits straight under the Skeleton3D, anything else in a BoneAttachment3D.
      const holder = isSkinned ? skeleton : sceneNode(gltf.name, 'boneAttachment', index);
      if (holder !== skeleton) addChild(skeleton, holder);
      addChild(holder, content);
      current = content;
    }
    this.sceneNodes.set(index, current);
    for (const child of gltf.children) this.generateCompat(child, skeleton, root);
  }

  /** `_process_mesh_instances` (`gltf_document.cpp:5888-5922`): each skinned mesh moves under its skeleton. */
  private moveSkinnedMeshesToSkeletons(): void {
    const { nodes, skinSkeletons } = this.source;
    nodes.forEach(({ skin, mesh }, index) => {
      if (skin < 0 || mesh < 0) return;
      const instance = this.meshInstances.get(index);
      const skeleton = this.skeletons[skinSkeletons[skin] ?? -1];
      if (!instance?.parent || !skeleton?.parent) return;
      removeFromParent(instance);
      addChild(skeleton, instance);
    });
  }
}

function flatten(node: SceneNode, parentPath: string, into: GltfSceneNode[]): GltfSceneNode[] {
  for (const child of node.children) {
    const path = parentPath === '' ? child.name : `${parentPath}/${child.name}`;
    into.push({ path, kind: child.kind, gltfNode: child.gltfNode });
    flatten(child, path, into);
  }
  return into;
}

/** The nodes below the scene root `source` imports as, in tree order. */
export function gltfImportScene(source: GltfSceneSource): GltfSceneNode[] {
  const root = new SceneBuilder(source).build();
  return root ? flatten(root, '', []) : [];
}
