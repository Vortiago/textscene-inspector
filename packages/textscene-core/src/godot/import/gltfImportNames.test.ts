import { describe, expect, it } from 'vitest';
import { gltfImportNames, type GltfNamingOptions, type GltfNodeRole } from './gltfImportNames';

const CURRENT: GltfNamingOptions = { namingVersion: 2, importAsSkeletonBones: false, fileName: 'robot' };
const GODOT_4_0: GltfNamingOptions = { ...CURRENT, namingVersion: 0 };

function names(json: unknown, options: GltfNamingOptions = CURRENT): string[] {
  return gltfImportNames(json, options).nodes.map(({ name }) => name);
}

function roles(json: unknown, options: GltfNamingOptions = CURRENT): GltfNodeRole[] {
  return gltfImportNames(json, options).nodes.map(({ role }) => role);
}

describe('gltfImportNames: named nodes', () => {
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

describe('gltfImportNames: unnamed nodes', () => {
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

describe('gltfImportNames: the scene name', () => {
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

describe('gltfImportNames: bones', () => {
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

  it('numbers a bone past the name its mesh import takes, which no node holds', () => {
    const json = {
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'robot_Blade', mesh: 0 }],
      meshes: [{ name: 'Blade' }],
      skins: [{ joints: [0] }],
    };
    expect(names(json)).toEqual(['robot_Blade_2']);
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

describe('gltfImportNames: malformed documents', () => {
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

describe('gltfImportNames: meshes', () => {
  const scene = { scenes: [{ name: 'Scene', nodes: [0] }], scene: 0 };

  it("names a mesh after the file and the glTF mesh, as godot_ball's sidecar keys it", () => {
    const json = {
      ...scene,
      nodes: [{ name: 'OBJ_GodotBall', mesh: 0 }],
      meshes: [{ name: 'MSH_GodotBall' }],
    };

    expect(gltfImportNames(json, { ...CURRENT, fileName: 'godot_ball' }).meshes).toEqual([
      'godot_ball_MSH_GodotBall',
    ]);
  });

  it('numbers a mesh name a node already took', () => {
    const json = { ...scene, nodes: [{ name: 'robot_Arm', mesh: 0 }], meshes: [{ name: 'Arm' }] };

    expect(gltfImportNames(json, CURRENT).meshes).toEqual(['robot_Arm2']);
  });

  it('names an unnamed mesh mesh (edge case)', () => {
    expect(gltfImportNames({ ...scene, nodes: [], meshes: [{}] }, CURRENT).meshes).toEqual(['robot_mesh']);
  });
});

describe('gltfImportNames: animations', () => {
  const animation = (name?: string, extra: object = {}) => ({
    ...(name === undefined ? {} : { name }),
    channels: [],
    samplers: [],
    ...extra,
  });
  const animationNames = (animations: unknown[]) =>
    gltfImportNames({ animations }, CURRENT).animations.map((entry) => entry?.name);

  it.each([
    ['idle_root.001', 'idle_root_001'],
    ['a:b', 'a_b'],
    ['a/b', 'a_b'],
    ['a,b', 'a_b'],
    ['a[b', 'a_b'],
  ])('replaces the characters of %s that an animation name cannot carry', (name, stored) => {
    expect(animationNames([animation(name)])).toEqual([stored]);
  });

  it('numbers a repeated name from 2, with no separator', () => {
    expect(animationNames([animation('walk'), animation('walk'), animation('walk')])).toEqual([
      'walk',
      'walk2',
      'walk3',
    ]);
  });

  it.each(['Walk_Loop', 'loopWalk', 'run-cycle', 'CycleRun'])(
    'loops %s, which begins or ends with loop or cycle',
    (name) => {
      expect(gltfImportNames({ animations: [animation(name)] }, CURRENT).animations[0]?.loops).toBe(true);
    }
  );

  it('does not loop a name that only contains loop', () => {
    expect(gltfImportNames({ animations: [animation('a_loop_b')] }, CURRENT).animations[0]?.loops).toBe(
      false
    );
  });

  it('reads the loop word in the name the glTF wrote, before the replacement', () => {
    const [entry] = gltfImportNames({ animations: [animation('loop.001')] }, CURRENT).animations;
    expect(entry).toEqual({ name: 'loop_001', loops: true });
  });

  it('names no animation without a name, a channels list or a samplers list', () => {
    const unnamed = animation();
    const noChannels = { name: 'a', samplers: [] };
    const noSamplers = { name: 'b', channels: [] };
    expect(gltfImportNames({ animations: [unnamed, noChannels, noSamplers] }, CURRENT).animations).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('names none for a document with no animations', () => {
    expect(gltfImportNames({ nodes: [] }, CURRENT).animations).toEqual([]);
  });
});
