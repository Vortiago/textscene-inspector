/**
 * A track into an instanced GLB binds the node at the path Godot's glTF importer gives it: a
 * skinned mesh below the Skeleton3D, and a node on a bone below the BoneAttachment3D of that bone.
 * A path that names no node of the imported scene binds nothing.
 */

import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../../logger';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { RIG_GLB } from '../../../resources/formats/glb/testing/rigGlb';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { synthesiseGLBScene } from '../../../resources/processors/createSceneProcessor';
import { moveAnimation, objectAt, playHalfway, PLAYER_BODY } from '../../../r3f/testing/animationPlayback';

const GLB_PATH = 'res://rig.glb';
const HALFWAY_X = 5;

/** `trackPath` is a path below the instancing node Rig. */
async function playRigTrack(trackPath: string, options = NO_SIDECAR) {
  const glb = await createGLBMesh(RIG_GLB, options);
  return playHalfway(
    `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="rig"]

${moveAnimation(`Rig/${trackPath}`)}
[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("rig")]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`,
    'Root/AnimationPlayer',
    async (fake) => {
      // The scene loads before the glTF it names, in a commit of its own, as a file does.
      await ReactThreeTestRenderer.act(async () =>
        fake.scenes._resolve(GLB_PATH, synthesiseGLBScene(GLB_PATH))
      );
      await ReactThreeTestRenderer.act(async () => fake.glbMeshes._resolve(GLB_PATH, glb));
    }
  );
}

describe('an AnimationPlayer track into an instanced GLB', () => {
  it('drives a node of the glTF by its path', async () => {
    const root = await playRigTrack('Armature');
    expect(objectAt(root, 'Armature').position.x).toBeCloseTo(HALFWAY_X, 1);
  });

  it('drives a skinned mesh through the Skeleton3D', async () => {
    const root = await playRigTrack('Armature/Skeleton3D/Body');
    expect(objectAt(root, 'Body').position.x).toBeCloseTo(HALFWAY_X, 1);
    expect(objectAt(root, 'Armature').position.x).toBe(0);
  });

  it('drives a node on a bone through the BoneAttachment3D of the bone', async () => {
    const root = await playRigTrack('Armature/Skeleton3D/Hip/Sword');
    expect(objectAt(root, 'Sword').position.x).toBeCloseTo(HALFWAY_X, 1);
  });

  it('drives a node on a bone through the BoneAttachment3D Godot 4.4 names after the node', async () => {
    const godot44 = { ...NO_SIDECAR, naming: { ...NO_SIDECAR.naming, namingVersion: 1 } };
    const root = await playRigTrack('Armature/Skeleton3D/Sword/Sword', godot44);
    expect(objectAt(root, 'Sword').position.x).toBeCloseTo(HALFWAY_X, 1);
  });

  it('binds nothing at the place the glTF holds a skinned mesh, and warns', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const root = await playRigTrack('Armature/Body');
    expect(objectAt(root, 'Body').position.x).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Root/Rig/Armature/Body'));
    warn.mockRestore();
  });

  it('binds nothing at a path that leaves out the BoneAttachment3D level', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const root = await playRigTrack('Armature/Hip/Sword');
    expect(objectAt(root, 'Sword').position.x).toBe(0);
    warn.mockRestore();
  });
});
