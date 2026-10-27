/**
 * A track binds the node its NodePath names, as Godot's `get_node` resolves it from the animation
 * root: never a same-named node elsewhere, nothing through a missing ancestor, a `..` sibling
 * without moving the root, and a node that escaped its parent's three group.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../../logger';
import { TscnParser } from '../../../parser/TscnParser';
import { fixturesDir } from '../../../parser/testing/parserKit';
import {
  moveAnimation,
  mountWithPlayer,
  objectAt,
  play,
  playHalfway,
  PLAYER_BODY,
  sceneRoot,
} from '../../../r3f/testing/animationPlayback';

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

  it('drives the node a %Name track names, through the owner’s unique-name table', async () => {
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('%Lamp')}
[node name="Root" type="Node3D"]

[node name="Props" type="Node3D" parent="."]

[node name="Lamp" type="Node3D" parent="Props"]
unique_name_in_owner = true

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`,
      'Root/AnimationPlayer'
    );
    expect(objectAt(root, 'Props', 'Lamp').position.x).toBeCloseTo(5, 1);
  });

  it('drives nothing through an empty root_node, which Godot refuses', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const root = await playHalfway(
      `[gd_scene format=3]

${moveAnimation('Target')}
[node name="Root" type="Node3D"]

[node name="Target" type="Node3D" parent="."]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
root_node = NodePath("")
${PLAYER_BODY}
`,
      'Root/AnimationPlayer'
    );
    expect(objectAt(root, 'Target').position.x).toBe(0);
    warn.mockRestore();
  });
});

describe('a track whose target mounts after the player binds', () => {
  const ARM_SCENE = `[gd_scene format=3]

[node name="ArmRoot" type="Node3D"]

[node name="Arm" type="Node3D" parent="."]
`;

  const HOST_SCENE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://arm.tscn" id="1_arm"]

${moveAnimation('Inst/Arm')}
[node name="Root" type="Node3D"]

[node name="Inst" parent="." instance=ExtResource("1_arm")]

[node name="AnimationPlayer" type="AnimationPlayer" parent="."]
${PLAYER_BODY}
`;

  /** Mounts the host with the player selected, so its mixer binds before the sub-scene loads. */
  const mountBeforeLoad = () => mountWithPlayer(HOST_SCENE, 'Root/AnimationPlayer');

  it('binds it once the sub-scene holding it loads', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { renderer, fake } = await mountBeforeLoad();
    await ReactThreeTestRenderer.act(async () => {
      fake.scenes._resolve('res://arm.tscn', new TscnParser().parse(ARM_SCENE));
    });
    await play();
    await renderer.advanceFrames(1, 0.5);
    expect(objectAt(sceneRoot(renderer), 'Inst', 'Arm').position.x).toBeCloseTo(5, 1);
    warn.mockRestore();
  });

  it('does not rebind for a load that leaves the target missing', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { fake } = await mountBeforeLoad();
    const warningsBefore = warn.mock.calls.length;
    await ReactThreeTestRenderer.act(async () => {
      fake.scenes._resolve('res://unrelated.tscn', new TscnParser().parse('[gd_scene format=3]\n'));
    });
    expect(warn.mock.calls.length).toBe(warningsBefore);
    warn.mockRestore();
  });

  it('keeps playing from the transport time when the target arrives mid-play', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { renderer, fake } = await mountBeforeLoad();
    await play();
    await renderer.advanceFrames(1, 0.4);
    await ReactThreeTestRenderer.act(async () => {
      fake.scenes._resolve('res://arm.tscn', new TscnParser().parse(ARM_SCENE));
    });
    await renderer.advanceFrames(1, 0.1);
    expect(objectAt(sceneRoot(renderer), 'Inst', 'Arm').position.x).toBeCloseTo(5, 1);
    warn.mockRestore();
  });
});
