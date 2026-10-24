/**
 * The look Godot gives the gizmos of a node the edited scene does not own: grey at alpha 0.6, in place
 * of the gizmo's own colour (`node_3d_editor_gizmos.cpp:907-917`). A node an instanced scene authored
 * wears it unless the edited scene lists the instance as `[editable]` (`:43-60`). The nodes here are
 * SpringArm3D, whose length line is a plugin gizmo drawn for every node.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { lineMaterials, lineOpacities } from './testing/GizmoScene';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { godotColorToLinear } from './godotColor';
import { INSTANTIATED_GIZMO_COLOUR } from './gizmo/gizmoVariant';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../nodes/physics/shared/debugColor';

import './nodes/index';

const ARM_SCENE = `[gd_scene format=3]

[node name="Arm" type="Node3D"]

[node name="Line" type="SpringArm3D" parent="."]
`;

const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://arm.tscn" id="1_arm"]

[node name="Root" type="Node3D"]

[node name="Locked" parent="." instance=ExtResource("1_arm")]

[node name="Open" parent="." instance=ExtResource("1_arm")]

[node name="Own" type="SpringArm3D" parent="."]

[editable path="Open"]
`;

// The length line draws in the collision colour when the edited scene owns the node.
const OWN_ALPHA = DEFAULT_COLLISION_DEBUG_COLOR.a;
const UNSELECTED = 0.3;

async function renderRoot(selectedPath: string | null) {
  const fake = createFakeResourceLoader();
  const parser = new TscnParser();
  fake.scenes.seed('res://arm.tscn', parser.parse(ARM_SCENE));
  const mainScene = parser.parse(MAIN_SCENE);
  return ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={mainScene} selectedPath={selectedPath}>
      <NodeDispatcher nodes={mainScene.nodes} />
    </SceneStack>
  );
}

// The indices of the lines in draw order: the dispatcher mounts Locked, Open, then Own.
const LOCKED = 0;
const OPEN = 1;
const OWN = 2;

describe('NodeDispatcher: gizmos of instanced nodes', () => {
  it('draws the line of a node in a locked instance at the instantiated alpha, faint when unselected', async () => {
    const opacities = lineOpacities(await renderRoot(null));
    expect(opacities[LOCKED]).toBeCloseTo(INSTANTIATED_GIZMO_COLOUR.a * UNSELECTED, 10);
  });

  it('draws the line of a node in a locked instance at the instantiated alpha when selected', async () => {
    const opacities = lineOpacities(await renderRoot('Root/Locked/Line'));
    expect(opacities[LOCKED]).toBeCloseTo(INSTANTIATED_GIZMO_COLOUR.a, 10);
  });

  it('draws the line in the instantiated grey', async () => {
    const renderer = await renderRoot(null);
    expect(lineMaterials(renderer)[LOCKED]!.color.toArray()).toEqual(
      godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray()
    );
  });

  it('draws the line of a node in an editable instance as the edited scene would', async () => {
    const opacities = lineOpacities(await renderRoot(null));
    expect(opacities[OPEN]).toBeCloseTo(OWN_ALPHA * UNSELECTED, 10);
  });

  it('draws the line of a node the edited scene authored as it would', async () => {
    const opacities = lineOpacities(await renderRoot(null));
    expect(opacities[OWN]).toBeCloseTo(OWN_ALPHA * UNSELECTED, 10);
  });
});
