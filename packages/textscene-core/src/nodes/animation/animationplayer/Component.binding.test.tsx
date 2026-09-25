/**
 * A track binds the node its NodePath names, as Godot's `get_node` resolves it from the animation
 * root: never a same-named node elsewhere, nothing through a missing ancestor, a `..` sibling
 * without moving the root, and a node that escaped its parent's three group.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../../logger';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { fixturesDir } from '../../../parser/testing/parserKit';

import '../../../r3f/nodes/index';

const mounted: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>[] = [];
afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

let transport: AnimationTransport;
function Capture() {
  transport = useAnimationTransport();
  return null;
}

/** One animation, "move", sliding the node at `trackPath` from x=0 to x=10 over one second. */
function moveAnimation(trackPath: string): string {
  return `[sub_resource type="Animation" id="Move"]
resource_name = "move"
length = 1.0
tracks/0/type = "value"
tracks/0/path = NodePath("${trackPath}:position")
tracks/0/interp = 1
tracks/0/keys = {
"times": PackedFloat32Array(0, 1),
"transitions": PackedFloat32Array(1, 1),
"update": 0,
"values": [Vector3(0, 0, 0), Vector3(10, 0, 0)]
}

[sub_resource type="AnimationLibrary" id="Lib"]
_data = {
"move": SubResource("Move")
}
`;
}

const PLAYER_BODY = 'libraries/ = SubResource("Lib")';

/** Mounts `tscn` through the dispatcher with `playerPath` selected, plays, and runs half a second. */
async function playHalfway(tscn: string, playerPath: string): Promise<THREE.Object3D> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="3d" loader={fake.loader} scene={parsed} selectedPath={playerPath}>
      <AnimationTransportProvider>
        <Capture />
        <NodeDispatcher nodes={parsed.nodes} />
      </AnimationTransportProvider>
    </SceneStack>
  );
  mounted.push(renderer);
  await ReactThreeTestRenderer.act(async () => transport.play());
  await renderer.advanceFrames(1, 0.5);
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  if (!root) throw new Error('the dispatcher mounted nothing');
  return root;
}

/** The named group at `names`, walking one name per level from the scene. */
function objectAt(root: THREE.Object3D, ...names: string[]): THREE.Object3D {
  let object: THREE.Object3D | undefined = root;
  for (const name of names) object = object?.getObjectByName(name);
  if (!object) throw new Error(`nothing at ${names.join('/')}`);
  return object;
}

describe('an AnimationPlayer track binds the node its path names', () => {
  it('drives a uniquely named child, the case name-binding also got right', async () => {
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('Target')}
[node name="Root" type="Node3D"]

[node name="Target" type="Node3D" parent="."]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`,
      'Root/AnimationPlayer'
    );
    expect(objectAt(root, 'Target').position.x).toBeCloseTo(5, 1);
  });

  it('moves Right/Arm and leaves Left/Arm, which shares its name', async () => {
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('Right/Arm')}
[node name="Root" type="Node3D"]

[node name="Left" type="Node3D" parent="."]

[node name="Arm" type="Node3D" parent="Left"]

[node name="Right" type="Node3D" parent="."]

[node name="Arm" type="Node3D" parent="Right"]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`,
      'Root/AnimationPlayer'
    );
    expect(objectAt(root, 'Right', 'Arm').position.x).toBeCloseTo(5, 1);
    expect(objectAt(root, 'Left', 'Arm').position.x).toBe(0);
  });

  it('binds nothing through an ancestor that does not exist, and warns', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('Nope/Arm')}
[node name="Root" type="Node3D"]

[node name="Right" type="Node3D" parent="."]

[node name="Arm" type="Node3D" parent="Right"]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`,
      'Root/AnimationPlayer'
    );
    expect(objectAt(root, 'Right', 'Arm').position.x).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Root/Nope/Arm'));
    warn.mockRestore();
  });

  it('drives a ../ sibling of the animation root, and leaves the root where it is', async () => {
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('../Sibling')}
[node name="Root" type="Node3D"]

[node name="Rig" type="Node3D" parent="."]

[node name="AnimationPlayer" type="AnimationPlayer" parent="Rig"]
${PLAYER_BODY}

[node name="Sibling" type="Node3D" parent="."]
`,
      'Root/Rig/AnimationPlayer'
    );
    expect(objectAt(root, 'Sibling').position.x).toBeCloseTo(5, 1);
    expect(objectAt(root, 'Rig').position.x).toBe(0);
  });

  it('drives a node that escaped its parent below a plain Node', async () => {
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('Folder/Mesh')}
[node name="Root" type="Node3D"]

[node name="Folder" type="Node" parent="."]

[node name="Mesh" type="Node3D" parent="Folder"]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`,
      'Root/AnimationPlayer'
    );
    expect(objectAt(root, 'Mesh').position.x).toBeCloseTo(5, 1);
  });

  it('drives the Lamp in unit-animation-player-parent-relative.tscn through its ../ track', async () => {
    const tscn = readFileSync(resolve(fixturesDir(), 'unit-animation-player-parent-relative.tscn'), 'utf8');
    const root = await playHalfway(tscn, 'Scene/Rig/AnimationPlayer');
    expect(objectAt(root, 'Lamp').position.x).toBeCloseTo(1, 1);
    expect(objectAt(root, 'Rig').position.x).toBe(0);
  });
});
