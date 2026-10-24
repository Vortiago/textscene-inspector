/**
 * The scene Godot 4.6.3's glTF importer builds, against `gltfImportScene.godot.json`: the nodes
 * `godot --headless --import` lists for each model, over naming versions 0, 1 and 2 and both
 * `nodes/import_as_skeleton_bones` values. Regenerate it with `testing/gltfScenePaths/measure.mjs`.
 */

import { describe, expect, it } from 'vitest';
import { validateNodeName } from '../string/nodeName';
import { gltfImportNames } from './gltfImportNames';
import measured from './gltfImportScene.godot.json';

type MeasuredNode = [path: string, type: string, bone?: string];

/** The nodes the importer adds that no glTF node stands for. */
const ADDED_TYPES = ['Skeleton3D', 'BoneAttachment3D', 'AnimationPlayer'];

/**
 * A node as Godot lists it: the path and, for a node that is no glTF node, its type and bone. A
 * bone name may hold a `.`, which a node name may not.
 */
function godotRow([path, type, bone]: MeasuredNode): unknown[] {
  if (!ADDED_TYPES.includes(type)) return [path, 'Node3D', undefined];
  return [path, type, bone === undefined ? undefined : validateNodeName(bone)];
}

describe.each(measured.models)('the scene built from $name', (model) => {
  it.each(model.imports)(
    'matches Godot for $file',
    ({ file, namingVersion, importAsSkeletonBones, nodes }) => {
      const names = gltfImportNames(model.gltf, { namingVersion, importAsSkeletonBones, fileName: file });
      const built = names.scene.map(({ path, kind, gltfNode }) => {
        if (kind === 'skeleton') return [path, 'Skeleton3D', undefined];
        if (kind === 'boneAttachment') return [path, 'BoneAttachment3D', names.nodes[gltfNode]!.name];
        if (kind === 'animationPlayer') return [path, 'AnimationPlayer', undefined];
        return [path, 'Node3D', undefined];
      });

      expect(built).toEqual((nodes as MeasuredNode[]).map(godotRow));
    }
  );
});
