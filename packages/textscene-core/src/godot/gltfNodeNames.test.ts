import { describe, expect, it } from 'vitest';
import { gltfNodeNames, type GltfNamingOptions } from './gltfNodeNames';

const CURRENT: GltfNamingOptions = { namingVersion: 2, importAsSkeletonBones: false, fileName: 'robot' };
const GODOT_4_0: GltfNamingOptions = { ...CURRENT, namingVersion: 0 };

function names(json: unknown, options: GltfNamingOptions = CURRENT): (string | null)[] {
  return gltfNodeNames(json, options);
}

describe('gltfNodeNames: named nodes', () => {
  it('numbers a repeated name from 2', () => {
    expect(names({ nodes: [{ name: 'Cube' }, { name: 'Cube' }, { name: 'Cube' }] })).toEqual([
      'Cube',
      'Cube2',
      'Cube3',
    ]);
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

  it('gives a joint no node name, and leaves the name free', () => {
    const json = { ...rig, nodes: [...rig.nodes, { name: 'Upper' }] };
    expect(names(json)).toEqual(['Arm', null, null, 'Body', 'Upper']);
  });

  it('makes a node between two joints a bone', () => {
    const json = {
      nodes: [{ name: 'Hip', children: [1] }, { name: 'Gap', children: [2] }, { name: 'Knee' }],
      skins: [{ joints: [0, 2] }],
    };
    expect(names(json)).toEqual([null, null, null]);
  });

  it('keeps a node under a joint a node from 4.5, and makes it a bone before', () => {
    const json = {
      nodes: [
        { name: 'Hand', children: [1] },
        { name: 'Sword', mesh: 0 },
      ],
      skins: [{ joints: [0] }],
    };
    expect(names(json)).toEqual([null, 'Sword']);
    expect(names(json, { ...CURRENT, namingVersion: 1 })).toEqual([null, null]);
  });

  it('makes every scene node but a leaf skinned mesh a bone under import_as_skeleton_bones', () => {
    expect(names(rig, { ...CURRENT, importAsSkeletonBones: true })).toEqual([null, null, null, 'Body']);
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
