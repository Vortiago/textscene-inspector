import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CasterPose } from './casterPose';

function caster(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry());
  mesh.castShadow = true;
  mesh.updateMatrixWorld();
  return mesh;
}

/** A pose that has taken `meshes` once. */
function posed(meshes: THREE.Mesh[]): CasterPose {
  const pose = new CasterPose();
  pose.update(meshes);
  return pose;
}

describe('CasterPose.update', () => {
  it('answers that nothing changed while every caster holds still', () => {
    const meshes = [caster(), caster()];

    expect(posed(meshes).update(meshes)).toBe(false);
  });

  it('answers that the pose changed when a caster moves', () => {
    const meshes = [caster()];
    const pose = posed(meshes);
    meshes[0]!.position.x = 1;
    meshes[0]!.updateMatrixWorld();

    expect(pose.update(meshes)).toBe(true);
  });

  it('answers that the pose changed when a caster is hidden', () => {
    const meshes = [caster(), caster()];
    const pose = posed(meshes);
    meshes[1]!.visible = false;

    expect(pose.update(meshes)).toBe(true);
  });

  it('answers that the pose changed when a caster takes another geometry', () => {
    const meshes = [caster()];
    const pose = posed(meshes);
    meshes[0]!.geometry = new THREE.SphereGeometry();

    expect(pose.update(meshes)).toBe(true);
  });

  it('ignores a mesh that casts no shadow (edge case)', () => {
    const still = caster();
    const receiver = caster();
    receiver.castShadow = false;
    const pose = posed([still, receiver]);
    receiver.position.y = 3;
    receiver.updateMatrixWorld();

    expect(pose.update([still, receiver])).toBe(false);
  });

  it("answers that the pose changed when an instanced caster's instances move", () => {
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), undefined, 2);
    instanced.castShadow = true;
    const pose = posed([instanced]);
    instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(2, 0, 0));
    instanced.instanceMatrix.needsUpdate = true;

    expect(pose.update([instanced])).toBe(true);
  });

  it("answers that the pose changed when a skinned caster's bones move", () => {
    const bone = new THREE.Bone();
    const skinned = new THREE.SkinnedMesh(new THREE.BoxGeometry());
    skinned.add(bone);
    skinned.bind(new THREE.Skeleton([bone]));
    skinned.castShadow = true;
    skinned.updateMatrixWorld();
    skinned.skeleton.update();
    const pose = posed([skinned]);
    bone.position.y = 1;
    skinned.updateMatrixWorld();
    skinned.skeleton.update();

    expect(pose.update([skinned])).toBe(true);
  });
});
