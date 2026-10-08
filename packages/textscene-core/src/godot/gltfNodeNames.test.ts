import { describe, expect, it } from 'vitest';
import { gltfNodeNames, type GltfNamingOptions, type GltfNodeRole } from './gltfNodeNames';

const CURRENT: GltfNamingOptions = { namingVersion: 2, importAsSkeletonBones: false, fileName: 'robot' };
const GODOT_4_0: GltfNamingOptions = { ...CURRENT, namingVersion: 0 };

function names(json: unknown, options: GltfNamingOptions = CURRENT): string[] {
  return gltfNodeNames(json, options).map(({ name }) => name);
}

function roles(json: unknown, options: GltfNamingOptions = CURRENT): GltfNodeRole[] {
  return gltfNodeNames(json, options).map(({ role }) => role);
}

describe('gltfNodeNames: named nodes', () => {
  it('numbers a repeated name from 2', () => {
    expect(names({ nodes: [{ name: 'Cube' }, { name: 'Cube' }, { name: 'Cube' }] })).toEqual([
      'Cube',
      'Cube2',
      'Cube3',
    ]);
  });

  it('skips a number a node took by name', () => {
    const nodes = [{ name: 'Cube' }, { name: 'Cube3' }, { name: 'Cube' }, { name: 'Cube' }, { name: 'Cube' }];
    expect(names({ nodes })).toEqual(['Cube', 'Cube3', 'Cube2', 'Cube4', 'Cube5']);
  });

  it('replaces each character a node name may not hold', () => {
    expect(names({ nodes: [{ name: 'Cube.001' }, { name: 'a:b@c/d"e%f' }] })).toEqual([
      'Cube_001',
      'a_b_c_d_e_f',
    ]);
  });

  it('numbers a node named Skeleton3D, as the importer reserves that name', () => {
    expect(names({ nodes: [{ name: 'Skeleton3D' }] })).toEqual(['Skeleton3D2']);
  });

  it('numbers a name that clashes once validated', () => {
    expect(names({ nodes: [{ name: 'Cube_001' }, { name: 'Cube.001' }] })).toEqual(['Cube_001', 'Cube_0012']);
  });
});

describe('gltfNodeNames: unnamed nodes', () => {
  it('names each by what it holds', () => {
    expect(names({ nodes: [{ mesh: 0 }, { camera: 0 }, {}, { mesh: 1 }] })).toEqual([
      'Mesh',
      'Camera',
      'Node',
      'Mesh2',
    ]);
  });

  it('takes each fallback twice before 4.2, so the first is numbered 2', () => {
    expect(names({ nodes: [{ mesh: 0 }, { camera: 0 }, {}, { mesh: 1 }] }, GODOT_4_0)).toEqual([
      'Mesh2',
      'Camera3D2',
      'Node2',
      'Mesh32',
    ]);
  });
});

describe('gltfNodeNames: the scene name', () => {
  it('reserves the scene name before 4.2', () => {
    const json = { scenes: [{ name: 'Robot', nodes: [0] }], nodes: [{ name: 'Robot' }] };
    expect(names(json, GODOT_4_0)).toEqual(['Robot2']);
  });

  it('reserves the file name for a scene named Scene before 4.2', () => {
    const json = { scenes: [{ name: 'Scene', nodes: [0] }], nodes: [{ name: 'robot' }] };
    expect(names(json, GODOT_4_0)).toEqual(['robot2']);
  });

  it('leaves the node names free from 4.2', () => {
    const json = { scenes: [{ name: 'Robot', nodes: [0] }], nodes: [{ name: 'Robot' }] };
    expect(names(json)).toEqual(['Robot']);
  });
});

describe('gltfNodeNames: bones', () => {
  /** Arm (0) holds the joints Upper (1) and Lower (2), and the skinned Body (3). */
  const rig = {
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Arm', children: [1, 3] },
      { name: 'Upper', children: [2] },
      { name: 'Lower' },
      { name: 'Body', mesh: 0, skin: 0 },
    ],
    skins: [{ joints: [1, 2] }],
  };
  /** The joint Hand (0) holds the mesh Sword (1). */
  const sword = {
    nodes: [
      { name: 'Hand', children: [1] },
      { name: 'Sword', mesh: 0 },
    ],
    skins: [{ joints: [0] }],
  };

  it('gives a joint the bone role, and marks a skinned mesh', () => {
    expect(roles(rig)).toEqual(['node', 'bone', 'bone', 'skinnedMesh']);
  });

  it('names the nodes before the bones, so a bone takes a name a node holds with _2', () => {
    const json = { ...rig, nodes: [...rig.nodes, { name: 'Upper' }] };
    expect(names(json)).toEqual(['Arm', 'Upper_2', 'Lower', 'Body', 'Upper']);
  });

  it('makes a node between two joints a bone', () => {
    const json = {
      nodes: [{ name: 'Hip', children: [1] }, { name: 'Gap', children: [2] }, { name: 'Knee' }],
      skins: [{ joints: [0, 2] }],
    };
    expect(roles(json)).toEqual(['bone', 'bone', 'bone']);
  });

  it('keeps a node under a joint a node from 4.5, and makes it a bone before', () => {
    expect(roles(sword)).toEqual(['bone', 'node']);
    expect(roles(sword, { ...CURRENT, namingVersion: 1 })).toEqual(['bone', 'bone']);
  });

  it('makes every scene node but a leaf skinned mesh a bone under import_as_skeleton_bones', () => {
    expect(roles(rig, { ...CURRENT, importAsSkeletonBones: true })).toEqual([
      'bone',
      'bone',
      'bone',
      'skinnedMesh',
    ]);
  });

  it('names an unnamed bone bone, numbered from 2 past a node of that name', () => {
    const json = {
      nodes: [{ children: [1] }, { mesh: 0 }, { name: 'bone' }],
      skins: [{ joints: [0] }],
    };
    expect(names(json, { ...CURRENT, namingVersion: 1 })).toEqual(['bone_2', 'bone_3', 'bone']);
  });

  it('gives a bone the validated node name of its BoneAttachment3D', () => {
    const json = {
      ...sword,
      nodes: [
        { name: 'Cube.001', children: [1] },
        { name: 'Blade.001', mesh: 0 },
      ],
    };
    expect(names(json, { ...CURRENT, namingVersion: 1 })).toEqual(['Cube_001', 'Blade_001']);
  });

  it('numbers a repeated bone name across skeletons before 4.5, and within its own from 4.5', () => {
    // L (0) and R (1) each hold a joint Head of its own skin.
    const json = {
      nodes: [
        { name: 'L', children: [2] },
        { name: 'R', children: [3] },
        { name: 'Head', mesh: 0 },
        { name: 'Head', mesh: 1 },
      ],
      skins: [{ joints: [2] }, { joints: [3] }],
    };
    expect(names(json, { ...CURRENT, namingVersion: 1 })).toEqual(['L', 'R', 'Head', 'Head_2']);
    expect(names(json)).toEqual(['L', 'R', 'Head', 'Head']);
  });

  it('numbers a repeated bone name in the order the skeleton adds its bones', () => {
    const json = {
      nodes: [
        { name: 'Hand', children: [1] },
        { name: 'Hand', mesh: 0 },
        { name: 'Other', mesh: 1 },
      ],
      skins: [{ joints: [0] }],
    };
    expect(names(json, { ...CURRENT, namingVersion: 1 })).toEqual(['Hand', 'Hand_2', 'Other']);
    expect(names(json, { ...CURRENT, importAsSkeletonBones: true })).toEqual(['Hand', 'Hand_2', 'Other']);
    expect(names(json)).toEqual(['Hand_2', 'Hand', 'Other']);
  });
});

describe('gltfNodeNames: malformed documents', () => {
  it('gives no names for a document that is not an object', () => {
    expect(names([{ name: 'Cube' }])).toEqual([]);
  });

  it('names an entry that is not an object as an empty node', () => {
    expect(names({ nodes: ['Cube', { name: 'Cube' }] })).toEqual(['Node', 'Cube']);
  });

  it('ignores a child index past the last node', () => {
    expect(names({ nodes: [{ name: 'Root', children: [5] }] })).toEqual(['Root']);
  });
});
