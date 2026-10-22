/**
 * The GLB animation driver binds to the node path the scene tree selects, through the real
 * NodeDispatcher → InstancedNode → GLBSceneRoot path. The node that instances the GLB is the GLB
 * root, so the driver sits at `<instancing node>/AnimationPlayer` for the tree and for an
 * AnimationTree alike (`gltf_document.cpp:7051-7053`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../contexts/AnimationTransportContext';
import { useOptionalSelection, type SelectionContextValue } from '../../contexts/SelectionContext';
import { AnimationDriverProvider } from '../../contexts/AnimationDriverContext';
import { GLB_SCENE_ROOT_TYPE } from '../../../resources/glbSceneRoot';

// Register node-type components (Node3D / GLBSceneRoot / …).
import '../../nodes/index';
import '../../../nodes/animation/animationtree/index';

const GLB_PATH = 'res://player.glb';

function makeAnimatedGlb(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const clip = new THREE.AnimationClip('idle', 1, [
    new THREE.VectorKeyframeTrack('Scene.position', [0, 1], [0, 0, 0, 0, 0, 0]),
  ]);
  root.animations = [clip];
  return root;
}

/** The synthesised single-node GLBSceneRoot scene a .glb PackedScene yields. */
function makeSynthScene(): TscnScene {
  return {
    nodes: [
      {
        rawProperties: {},
        name: 'player', // basename of player.glb
        type: GLB_SCENE_ROOT_TYPE,
        children: [],
        properties: { glbPath: GLB_PATH } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [],
  };
}

function makeLoader(): ResourceLoader {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(GLB_PATH, makeSynthScene());
  fake.glbMeshes.seed(GLB_PATH, makeAnimatedGlb());
  return fake.loader;
}

/** Host: a Player instance node whose instance is the GLB directly. */
function makeHostNode(): TscnNode {
  return {
    rawProperties: {},
    name: 'Player',
    type: 'Node3D',
    instance: 'ExtResource("glb_1")',
    children: [],
    properties: { name: 'Player' } as Record<string, unknown>,
  };
}

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

describe('GLB driver — selection path through the real dispatcher', () => {
  it('populates the transport when the GLB AnimationPlayer row (Player/AnimationPlayer) is selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack
        loader={makeLoader()}
        scene={{
          internalResources: [],
          externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
        }}
      >
        <AnimationTransportProvider>
          <Capture />
          <NodeDispatcher nodes={[makeHostNode()]} />
        </AnimationTransportProvider>
      </SceneStack>
    );

    // Nothing selected → no driver registered.
    expect(transport.clips).toEqual([]);

    // Selecting the GLB root row does not drive the tab: as in Godot, the clips live on the
    // AnimationPlayer child.
    await ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath('Player'));
    expect(transport.hasPlayer).toBe(false);

    // Select the synthesised AnimationPlayer row at its dispatcher-composed path.
    await ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath('Player/AnimationPlayer'));

    expect(transport.hasPlayer).toBe(true);
    // The tree measures the scrubber from the clip of the driver it found, 1 s long.
    expect(transport.duration).toBe(1);

    await renderer.unmount();
  });
});

const TREE_SCENE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="glb_1"]

[sub_resource type="AnimationNodeAnimation" id="Idle"]
animation = &"idle"

[sub_resource type="AnimationNodeBlendTree" id="Blend"]
nodes/idle/node = SubResource("Idle")
node_connections = [&"output", 0, &"idle"]

[node name="Root" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("glb_1")]

[node name="Tree" type="AnimationTree" parent="."]
tree_root = SubResource("Blend")
anim_player = NodePath("../Body/AnimationPlayer")
active = true
`;

describe('AnimationTree — the GLB animation driver through the real dispatcher', () => {
  it('finds the driver of the GLB its anim_player names by the path Godot gives the AnimationPlayer', async () => {
    const scene = new TscnParser().parse(TREE_SCENE);
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack
        loader={makeLoader()}
        scene={{ internalResources: scene.internalResources, externalResources: scene.externalResources }}
      >
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <NodeDispatcher nodes={scene.nodes} />
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SceneStack>
    );
    await ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath('Root/Tree'));

    // The tree measures the scrubber from the clip of the driver it found, 1 s long.
    expect(transport.duration).toBe(1);

    await renderer.unmount();
  });
});
