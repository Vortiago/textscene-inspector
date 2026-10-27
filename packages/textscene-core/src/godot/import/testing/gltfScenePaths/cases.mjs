/**
 * The glTF documents `measure.mjs` imports through Godot, one per shape of skeleton, attachment and
 * root that the importer places differently. Each is a node list over two triangle meshes, as
 * `nodesGlb` builds them, so `gltfImportScene.godot.json` holds the same documents.
 */

const TRIANGLE_PRIMITIVE = { attributes: { POSITION: 0 } };
const LIGHT_EXTENSION = 'KHR_lights_punctual';

/** A document over `nodes`. The scene lists each node that no other node lists as a child. */
function document(nodes, extra = {}) {
  const children = new Set(nodes.flatMap((node) => node.children ?? []));
  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i).filter((i) => !children.has(i)) }],
    nodes,
    meshes: [{ primitives: [TRIANGLE_PRIMITIVE] }, { primitives: [TRIANGLE_PRIMITIVE, TRIANGLE_PRIMITIVE] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
    ...extra,
  };
}

const CAMERA = { cameras: [{ type: 'perspective', perspective: { yfov: 1, znear: 0.1 } }] };
const LIGHT = {
  extensionsUsed: [LIGHT_EXTENSION],
  extensions: { [LIGHT_EXTENSION]: { lights: [{ type: 'point', color: [1, 1, 1], intensity: 1 }] } },
};
const lightNode = (name, children) => ({
  name,
  children,
  extensions: { [LIGHT_EXTENSION]: { light: 0 } },
});
const skin = (...joints) => ({ joints });

/** A clip with one translation channel, so the importer adds its AnimationPlayer. */
const CLIP = {
  animations: [
    {
      name: 'idle',
      channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
      samplers: [{ input: 1, output: 2 }],
    },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    { bufferView: 0, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [1] },
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
  ],
};

export const CASES = [
  {
    name: 'plain',
    gltf: document(
      [
        { name: 'A', children: [1, 2] },
        { name: 'B', mesh: 0 },
        { name: 'C', camera: 0 },
      ],
      CAMERA
    ),
  },
  {
    name: 'repeats',
    gltf: document([{ name: 'Cube' }, { name: 'Cube' }, { name: 'Cube', children: [3] }, { name: 'Cube' }]),
  },
  {
    name: 'reserved',
    gltf: document([{ name: 'Skeleton3D' }, { name: 'AnimationPlayer' }], CLIP),
  },
  {
    name: 'orphan',
    gltf: document([{ name: 'A' }, { name: 'B' }, { name: 'C' }], { scenes: [{ nodes: [2, 0] }] }),
  },
  {
    name: 'singleroot',
    gltf: document(
      [
        { name: 'Lamp', children: [1] },
        { name: 'Child', children: [2] },
        { name: 'Grand', mesh: 0 },
      ],
      {
        extensionsUsed: ['GODOT_single_root'],
      }
    ),
  },
  {
    name: 'sword',
    gltf: document(
      [
        { name: 'Hand', children: [1] },
        { name: 'Sword', mesh: 0 },
      ],
      { skins: [skin(0)] }
    ),
  },
  {
    name: 'jointmesh',
    gltf: document(
      [
        { name: 'Arm', children: [1] },
        { name: 'Hand', mesh: 0 },
      ],
      { skins: [skin(0, 1)] }
    ),
  },
  {
    name: 'jointmeshchild',
    gltf: document(
      [
        { name: 'Arm', children: [1] },
        { name: 'Hand', mesh: 0, children: [2] },
        { name: 'Gem', mesh: 0 },
      ],
      {
        skins: [skin(0, 1)],
      }
    ),
  },
  {
    name: 'dotted',
    gltf: document(
      [
        { name: 'Cube.001', children: [1] },
        { name: 'Blade.001', mesh: 0 },
      ],
      { skins: [skin(0)] }
    ),
  },
  {
    name: 'unnamed',
    gltf: document([{ children: [1] }, { mesh: 0, children: [2] }, { camera: 0 }], {
      skins: [skin(0)],
      ...CAMERA,
    }),
  },
  {
    name: 'deep',
    gltf: document(
      [
        { name: 'Root', children: [1] },
        { name: 'Arm', children: [2] },
        { name: 'Hand', children: [3] },
        { name: 'Sword', mesh: 0, children: [4] },
        { name: 'Gem', mesh: 0 },
      ],
      { skins: [skin(1, 2)] }
    ),
  },
  {
    name: 'camera',
    gltf: document(
      [
        { name: 'Hand', children: [1] },
        { name: 'Eye', camera: 0 },
      ],
      { skins: [skin(0)], ...CAMERA }
    ),
  },
  {
    name: 'light',
    gltf: document([{ name: 'Hand', children: [1] }, lightNode('Lamp')], { skins: [skin(0)], ...LIGHT }),
  },
  {
    name: 'jointcamera',
    gltf: document(
      [
        { name: 'Arm', children: [1] },
        { name: 'Eye', camera: 0 },
      ],
      { skins: [skin(0, 1)], ...CAMERA }
    ),
  },
  {
    name: 'jointlight',
    gltf: document([{ name: 'Arm', children: [1] }, lightNode('Lamp')], { skins: [skin(0, 1)], ...LIGHT }),
  },
  {
    name: 'clash',
    gltf: document([{ name: 'Root', children: [1, 2] }, { name: 'Hand' }, { name: 'Hand', mesh: 0 }], {
      skins: [skin(1)],
    }),
  },
  {
    name: 'twoskel',
    gltf: document(
      [
        { name: 'Root', children: [1, 3] },
        { name: 'Head', children: [2] },
        { name: 'Hat' },
        { name: 'Head', children: [4] },
        { name: 'Cap' },
      ],
      { skins: [skin(1, 2), skin(3, 4)] }
    ),
  },
  {
    name: 'skinned',
    gltf: document(
      [{ name: 'Armature', children: [1, 2] }, { name: 'Hip' }, { name: 'Body', mesh: 0, skin: 0 }],
      {
        skins: [skin(1)],
      }
    ),
  },
  {
    name: 'skinnedchild',
    gltf: document(
      [
        { name: 'Armature', children: [1, 2] },
        { name: 'Hip' },
        { name: 'Body', mesh: 0, skin: 0, children: [3] },
        { name: 'Gem', mesh: 0 },
      ],
      { skins: [skin(1)] }
    ),
  },
  {
    name: 'skinnedjointchild',
    gltf: document(
      [
        { name: 'Armature', children: [1] },
        { name: 'Hip', children: [2] },
        { name: 'Body', mesh: 0, skin: 0 },
      ],
      { skins: [skin(1)] }
    ),
  },
  {
    name: 'skinnedtwo',
    gltf: document(
      [
        { name: 'Armature', children: [1, 2, 3] },
        { name: 'Hip' },
        { name: 'Body', mesh: 0, skin: 0 },
        { name: 'Head', mesh: 1, skin: 0 },
      ],
      { skins: [skin(1)] }
    ),
  },
  {
    name: 'nested',
    gltf: document(
      [
        { name: 'Root', children: [1] },
        { name: 'Hip', children: [2] },
        { name: 'Prop', children: [3] },
        { name: 'Finger' },
      ],
      { skins: [skin(1), skin(3)] }
    ),
  },
  {
    name: 'rootjoint',
    gltf: document([{ name: 'Hip', children: [1] }, { name: 'Knee', children: [2] }, { name: 'Foot' }], {
      skins: [skin(0, 1, 2)],
    }),
  },
  {
    name: 'gap',
    gltf: document([{ name: 'Root', children: [1] }, { name: 'Mid', children: [2] }, { name: 'Hand' }], {
      skins: [skin(0, 2)],
    }),
  },
  {
    name: 'siblings',
    gltf: document([{ name: 'Root', children: [1, 2] }, { name: 'A' }, { name: 'B' }], {
      skins: [skin(1, 2)],
    }),
  },
  {
    name: 'animated',
    gltf: document(
      [
        { name: 'Hand', children: [1] },
        { name: 'Sword', mesh: 0 },
      ],
      { skins: [skin(0)], ...CLIP }
    ),
  },
  {
    name: 'skinneddeep',
    gltf: document(
      [
        { name: 'Rig', children: [1] },
        { name: 'Armature', children: [2, 3] },
        { name: 'Hip' },
        { name: 'Body', mesh: 0, skin: 0 },
      ],
      { skins: [skin(2)] }
    ),
  },
  {
    name: 'skinnedbone',
    gltf: document(
      [
        { name: 'Armature', children: [1] },
        { name: 'Hip', mesh: 0, skin: 0, children: [2] },
        { name: 'Gem', mesh: 0 },
      ],
      { skins: [skin(1)] }
    ),
  },
  {
    name: 'apart',
    gltf: document(
      [
        { name: 'Root', children: [1, 3] },
        { name: 'Left', children: [2] },
        { name: 'LeftHip' },
        { name: 'Right', children: [4] },
        { name: 'RightHip' },
      ],
      { skins: [skin(2), skin(4)] }
    ),
  },
  {
    name: 'shared',
    gltf: document(
      [
        { name: 'Armature', children: [1, 3, 4] },
        { name: 'Hip', children: [2] },
        { name: 'Knee' },
        { name: 'Body', mesh: 0, skin: 0 },
        { name: 'Head', mesh: 1, skin: 1 },
      ],
      { skins: [skin(1, 2), skin(1)] }
    ),
  },
  {
    name: 'farskin',
    gltf: document(
      [
        { name: 'Rig', children: [1] },
        { name: 'Hip' },
        { name: 'Props', children: [3] },
        { name: 'Body', mesh: 0, skin: 0 },
      ],
      { skins: [skin(1)] }
    ),
  },
  {
    name: 'skeletonname',
    gltf: document(
      [{ name: 'Skeleton3D', children: [1, 2] }, { name: 'Hip' }, { name: 'Skeleton3D', mesh: 0, skin: 0 }],
      { skins: [skin(1)] }
    ),
  },
  {
    name: 'unnamedbones',
    gltf: document([{ children: [1] }, { children: [2] }, { mesh: 0 }], { skins: [skin(0, 1)] }),
  },
  {
    name: 'secondroot',
    gltf: document(
      [
        { name: 'First', mesh: 0 },
        { name: 'Hip', children: [2] },
        { name: 'Sword', mesh: 0 },
      ],
      {
        skins: [skin(1)],
      }
    ),
  },
  {
    name: 'rootskinned',
    gltf: document([{ name: 'Body', mesh: 0, skin: 0, children: [1] }, { name: 'Hip' }], {
      skins: [skin(1)],
      extensionsUsed: ['GODOT_single_root'],
    }),
  },
  {
    name: 'singleskeleton',
    gltf: document(
      [
        { name: 'Lamp', children: [1] },
        { name: 'Armature', children: [2, 3] },
        { name: 'Hip' },
        { name: 'Body', mesh: 0, skin: 0 },
      ],
      { skins: [skin(2)], extensionsUsed: ['GODOT_single_root'] }
    ),
  },
  {
    name: 'siblingnames',
    gltf: document(
      [
        { name: 'Hand', children: [1, 2, 3] },
        { name: 'Sword', mesh: 0 },
        { name: 'Sword2', mesh: 0 },
        { name: 'Sword', mesh: 0 },
      ],
      { skins: [skin(0)] }
    ),
  },
];

/** Corpus models, by path from the repository root: the skinned ones, and plain ones to prove no skin changes nothing. */
export const CORPUS = [
  { name: 'player', source: 'scenes/demos/3d/platformer/player/player.glb' },
  { name: 'enemy', source: 'scenes/demos/3d/platformer/enemy/enemy.glb' },
  { name: 'mannequiny', source: 'scenes/demos/3d/ragdoll_physics/characters/mannequiny.glb' },
  { name: 'robot', source: 'scenes/demos/viewport/3d_in_2d/robot.glb' },
  { name: 'room', source: 'scenes/demos/3d/occlusion_culling_mesh_lod/room.glb' },
  { name: 'testbed', source: 'scenes/demos/3d/material_testers/models/test_bed/test_bed.glb' },
  { name: 'rig', source: 'scenes/fixtures/meshes/unit-glb-rig.glb' },
];
