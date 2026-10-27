import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { godotMatrixWorld, placeSkinnedMeshInSkeletonSpace } from './skinnedMeshSpace';

const rounded = (matrix: THREE.Matrix4): number[] =>
  matrix.elements.map((v) => Math.round(v * 1e6) / 1e6 + 0);

/** A skeleton frame turned and moved in the scene, a Hip bone below it, and a skinned mesh beside the bone. */
function skinnedMeshBesideBone() {
  const frame = new THREE.Group();
  frame.rotation.y = Math.PI / 2;
  frame.position.set(5, 0, 0);
  const hip = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  frame.add(hip, mesh);
  mesh.bind(new THREE.Skeleton([hip]), new THREE.Matrix4());
  const scene = new THREE.Scene();
  scene.add(frame);
  scene.updateMatrixWorld(true);
  placeSkinnedMeshInSkeletonSpace(mesh);
  return { frame, mesh, scene };
}

describe('placeSkinnedMeshInSkeletonSpace', () => {
  it('leaves the mesh where the skeleton puts it, whatever the skeleton frame does', () => {
    const { mesh, scene } = skinnedMeshBesideBone();

    scene.updateMatrixWorld(true);

    expect(rounded(mesh.matrixWorld)).toEqual(rounded(new THREE.Matrix4()));
  });

  it('applies the transform of the mesh in the space of the skeleton, as Godot does below a Skeleton3D', () => {
    const { frame, mesh, scene } = skinnedMeshBesideBone();
    mesh.position.set(2, 0, 0);
    mesh.scale.setScalar(0.7);

    scene.updateMatrixWorld(true);

    const local = new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale);
    const expected = frame.matrixWorld.clone().multiply(local).multiply(frame.matrixWorld.clone().invert());
    expect(rounded(mesh.matrixWorld)).toEqual(rounded(expected));
  });

  it('drops the transform the glTF gives the mesh node, which Godot resets when it moves the mesh', () => {
    const frame = new THREE.Group();
    const hip = new THREE.Bone();
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    mesh.position.set(9, 9, 9);
    frame.add(hip, mesh);
    mesh.bind(new THREE.Skeleton([hip]), new THREE.Matrix4());

    placeSkinnedMeshInSkeletonSpace(mesh);

    expect(mesh.position.toArray()).toEqual([0, 0, 0]);
  });
});

describe('placeSkinnedMeshInSkeletonSpace bind matrix', () => {
  it('binds the mesh with the identity, which is the space Godot gives its vertices', () => {
    const { mesh } = skinnedMeshBesideBone();
    mesh.bindMatrix.makeTranslation(3, 0, 0);

    placeSkinnedMeshInSkeletonSpace(mesh);

    expect(rounded(mesh.bindMatrix)).toEqual(rounded(new THREE.Matrix4()));
    expect(rounded(mesh.bindMatrixInverse)).toEqual(rounded(new THREE.Matrix4()));
  });
});

describe('godotMatrixWorld', () => {
  it('gives the world matrix of an object that is no skinned mesh below a Skeleton3D', () => {
    const object = new THREE.Object3D();
    object.position.set(1, 2, 3);
    object.updateMatrixWorld(true);

    expect(rounded(godotMatrixWorld(object, new THREE.Matrix4()))).toEqual(rounded(object.matrixWorld));
  });

  it('gives a skinned mesh the transform of its node below the Skeleton3D: the frame times its own', () => {
    const { frame, mesh, scene } = skinnedMeshBesideBone();
    mesh.position.set(2, 0, 0);
    scene.updateMatrixWorld(true);

    const expected = frame.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(2, 0, 0));
    expect(rounded(godotMatrixWorld(mesh, new THREE.Matrix4()))).toEqual(rounded(expected));
  });
});
