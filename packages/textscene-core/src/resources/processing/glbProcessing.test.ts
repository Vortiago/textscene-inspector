/**
 * Unit tests for GLB processing helpers.
 *
 * `cloneWithMaterials` guards the three.js single-parent + shared-material
 * trap: `Object3D.clone(true)` copies the hierarchy but NOT materials, so
 * without explicit material cloning every instance would share material
 * references and mutations would bleed between scene instances.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  cloneWithMaterials,
  createGLBMesh,
  disposeClonedMaterials,
  gltfResourceDir,
  initGlbModules,
  isGLBPath,
} from './glbProcessing';

/**
 * Locate a repo-relative asset by walking up from cwd until it's found —
 * cwd differs between a `--filter` run (package dir) and a recursive
 * `pnpm test` run, so a fixed relative path is not portable.
 */
function findRepoAsset(relative: string): string {
  let dir = process.cwd();
  // Walk up to the filesystem root (where dirname is a fixed point).
  for (let parent = dirname(dir); parent !== dir; dir = parent, parent = dirname(dir)) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Asset not found walking up from ${process.cwd()}: ${relative}`);
}

// cloneWithMaterials uses SkeletonUtils.clone, which is lazily imported on the
// first GLB load. Pre-initialise once for the whole test file so tests that
// call cloneWithMaterials directly don't need to go through createGLBMesh first.
beforeAll(async () => {
  await initGlbModules();
});

describe('createGLBMesh', () => {
  it('surfaces a GLB’s embedded animation clips on the returned object', async () => {
    // The committed platformer player.glb carries Blender-exported clips; a
    // Godot GLB import would expose these on the model's AnimationPlayer. The
    // loader returns them on `gltf.animations`, which we attach to the scene
    // object so the GLB animation driver can play them.
    const glbPath = findRepoAsset('scenes/demos/3d/platformer/player/player.glb');
    const buffer = readFileSync(glbPath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    const object = await createGLBMesh(arrayBuffer as ArrayBuffer);
    const names = object.animations.map((c) => c.name);

    expect(names).toEqual(
      expect.arrayContaining(['idle', 'run', 'jump', 'walk', 'falling'])
    );
  });
});

describe('gltfResourceDir', () => {
  it("yields the glTF's own res:// directory for relative buffer/image resolution", () => {
    expect(gltfResourceDir('res://stage/model.gltf')).toBe('res://stage/');
    expect(gltfResourceDir('res://town/lamp/scene.gltf')).toBe('res://town/lamp/');
  });

  it('yields empty for a bare filename', () => {
    expect(gltfResourceDir('model.glb')).toBe('');
  });
});

describe('isGLBPath', () => {
  it('matches .glb and .gltf extensions', () => {
    expect(isGLBPath('model.glb')).toBe(true);
    expect(isGLBPath('model.gltf')).toBe(true);
    expect(isGLBPath('res://meshes/rock.glb')).toBe(true);
  });

  it('is case-insensitive on the extension', () => {
    expect(isGLBPath('MODEL.GLB')).toBe(true);
    expect(isGLBPath('Model.GlTf')).toBe(true);
  });

  it('rejects other extensions and near-misses', () => {
    expect(isGLBPath('model.obj')).toBe(false);
    expect(isGLBPath('model.glbx')).toBe(false);
    expect(isGLBPath('glb.png')).toBe(false);
    expect(isGLBPath('model.gltf.import')).toBe(false);
    expect(isGLBPath('')).toBe(false);
  });

  it('does not match when a query string trails the extension (current contract)', () => {
    // split('.').pop() yields "glb?v=2", which is not a recognised extension.
    expect(isGLBPath('model.glb?v=2')).toBe(false);
  });

  it('treats a bare extensionless "glb" segment as a match (current contract quirk)', () => {
    // "glb".split('.').pop() is "glb" itself; a directory path is not.
    expect(isGLBPath('glb')).toBe(true);
    expect(isGLBPath('some/dir/glb')).toBe(false);
  });
});

describe('cloneWithMaterials', () => {
  function makeSource(): {
    root: THREE.Group;
    meshSingle: THREE.Mesh;
    meshArray: THREE.Mesh;
  } {
    const root = new THREE.Group();
    root.name = 'root';

    const meshSingle = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    meshSingle.name = 'single';
    root.add(meshSingle);

    const nested = new THREE.Group();
    nested.name = 'nested';
    const meshArray = new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      new THREE.MeshBasicMaterial({ color: 0x0000ff }),
    ]);
    meshArray.name = 'array';
    nested.add(meshArray);
    root.add(nested);

    return { root, meshSingle, meshArray };
  }

  function findMesh(root: THREE.Object3D, name: string): THREE.Mesh {
    const found = root.getObjectByName(name);
    if (!(found instanceof THREE.Mesh)) {
      throw new Error(`Expected Mesh named ${name}`);
    }
    return found;
  }

  it('clones the object graph: new instances at every level, structure preserved', () => {
    const { root, meshSingle, meshArray } = makeSource();
    const cloned = cloneWithMaterials(root);

    expect(cloned).not.toBe(root);
    expect(cloned.uuid).not.toBe(root.uuid);
    expect(cloned.children).toHaveLength(2);

    const clonedSingle = findMesh(cloned, 'single');
    const clonedArray = findMesh(cloned, 'array');
    expect(clonedSingle.uuid).not.toBe(meshSingle.uuid);
    expect(clonedArray.uuid).not.toBe(meshArray.uuid);
  });

  it('clones single-material references (different uuid)', () => {
    const { root, meshSingle } = makeSource();
    const cloned = cloneWithMaterials(root);
    const clonedSingle = findMesh(cloned, 'single');

    const sourceMat = meshSingle.material as THREE.MeshStandardMaterial;
    const clonedMat = clonedSingle.material as THREE.MeshStandardMaterial;
    expect(clonedMat).not.toBe(sourceMat);
    expect(clonedMat.uuid).not.toBe(sourceMat.uuid);
  });

  it('mutating the clone single material leaves the source untouched', () => {
    const { root, meshSingle } = makeSource();
    const cloned = cloneWithMaterials(root);
    const clonedMat = findMesh(cloned, 'single').material as THREE.MeshStandardMaterial;

    clonedMat.color.set(0x123456);
    clonedMat.metalness = 0.9;

    const sourceMat = meshSingle.material as THREE.MeshStandardMaterial;
    expect(sourceMat.color.getHex()).toBe(0xff0000);
    expect(sourceMat.metalness).not.toBe(0.9);
  });

  it('clones material arrays element-wise into a new array', () => {
    const { root, meshArray } = makeSource();
    const cloned = cloneWithMaterials(root);
    const clonedArrayMesh = findMesh(cloned, 'array');

    const sourceMats = meshArray.material as THREE.MeshBasicMaterial[];
    const clonedMats = clonedArrayMesh.material as THREE.MeshBasicMaterial[];

    expect(Array.isArray(clonedMats)).toBe(true);
    expect(clonedMats).toHaveLength(2);
    expect(clonedMats).not.toBe(sourceMats);
    expect(clonedMats[0]!.uuid).not.toBe(sourceMats[0]!.uuid);
    expect(clonedMats[1]!.uuid).not.toBe(sourceMats[1]!.uuid);
  });

  it('mutating a clone array material leaves the source array untouched', () => {
    const { root, meshArray } = makeSource();
    const cloned = cloneWithMaterials(root);
    const clonedMats = findMesh(cloned, 'array').material as THREE.MeshBasicMaterial[];

    clonedMats[0]!.color.set(0xffffff);
    clonedMats[1]!.opacity = 0.1;

    const sourceMats = meshArray.material as THREE.MeshBasicMaterial[];
    expect(sourceMats[0]!.color.getHex()).toBe(0x00ff00);
    expect(sourceMats[1]!.opacity).toBe(1);
  });

  it('parenting the clone does not steal the source from its parent (single-parent rule)', () => {
    const { root } = makeSource();
    const parentA = new THREE.Group();
    const parentB = new THREE.Group();
    parentA.add(root);

    const cloned = cloneWithMaterials(root);
    parentB.add(cloned);

    expect(root.parent).toBe(parentA);
    expect(cloned.parent).toBe(parentB);
  });

  it('rebinds a SkinnedMesh to the cloned skeleton (not the source bones)', () => {
    // A plain Object3D.clone(true) leaves the cloned SkinnedMesh.skeleton
    // pointing at the SOURCE bones, so animating one instance deforms another
    // (or the template). A skeleton-aware clone rebinds to the cloned bones.
    const root = new THREE.Group();
    root.name = 'armature';
    const bone = new THREE.Bone();
    bone.name = 'b0';
    root.add(bone);
    const skinned = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial()
    );
    skinned.name = 'skin';
    root.add(skinned);
    skinned.bind(new THREE.Skeleton([bone]));

    const cloned = cloneWithMaterials(root);
    const clonedSkin = findMesh(cloned, 'skin') as THREE.SkinnedMesh;
    const clonedBone = cloned.getObjectByName('b0');

    expect(clonedSkin.skeleton.bones[0]).not.toBe(bone);
    expect(clonedSkin.skeleton.bones[0]).toBe(clonedBone);
  });

  it('carries GLB-embedded clips onto the clone (so a per-consumer clone stays animatable)', () => {
    const { root } = makeSource();
    const clip = new THREE.AnimationClip('idle', 1, [
      new THREE.VectorKeyframeTrack('single.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ]);
    root.animations = [clip];

    const cloned = cloneWithMaterials(root);

    // Clips are stateless (the mixer holds playback state) and bind by name —
    // the clone has the same node names, so sharing the same clip reference is
    // correct and cheap.
    expect(cloned.animations).toContain(clip);
  });
});

describe('disposeClonedMaterials', () => {
  function findMesh(root: THREE.Object3D, name: string): THREE.Mesh {
    const found = root.getObjectByName(name);
    if (!(found instanceof THREE.Mesh)) {
      throw new Error(`Expected Mesh named ${name}`);
    }
    return found;
  }

  it('disposes a single-material mesh clone without touching its (shared) geometry', () => {
    const source = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial()
    );
    source.name = 'single';
    const clone = cloneWithMaterials(source);
    const clonedMesh = findMesh(clone, 'single');
    const materialSpy = vi.spyOn(clonedMesh.material as THREE.Material, 'dispose');
    const geometrySpy = vi.spyOn(clonedMesh.geometry, 'dispose');

    disposeClonedMaterials(clone);

    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(geometrySpy).not.toHaveBeenCalled();
  });

  it('disposes every material in a material-array mesh clone', () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
    ]);
    source.name = 'array';
    const clone = cloneWithMaterials(source);
    const clonedMesh = findMesh(clone, 'array');
    const mats = clonedMesh.material as THREE.Material[];
    const spies = mats.map((m) => vi.spyOn(m, 'dispose'));

    disposeClonedMaterials(clone);

    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it('does not dispose the SOURCE material (only the clone owns the disposed instance)', () => {
    const source = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial()
    );
    source.name = 'single';
    const clone = cloneWithMaterials(source);
    const sourceMaterialSpy = vi.spyOn(source.material as THREE.Material, 'dispose');

    disposeClonedMaterials(clone);

    expect(sourceMaterialSpy).not.toHaveBeenCalled();
  });
});
