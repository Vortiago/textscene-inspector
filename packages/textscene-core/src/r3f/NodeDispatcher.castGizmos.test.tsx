/**
 * The dispatcher mounts each cast node's gizmo through the Gizmos toggle alone: the RayCast3D line
 * and pyramid and the ShapeCast3D sweep line and wireframe draw in the node's debug colour in every
 * selection and instance state, because the cast plugins pass the node's own debug material and
 * fetch no variant (`ray_cast_3d_gizmo_plugin.cpp:61-67`), as the SpringArm3D length line draws
 * faint in NodeDispatcher.instantiatedGizmos.test.tsx instead.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { lineMaterials, lineOpacities } from './testing/GizmoScene';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { godotColorToLinear } from './godotColor';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha } from './gizmo/gizmoVariant';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../nodes/physics/shared/debugColor';

import './nodes/index';

const CASTS_SCENE = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxShape3D" id="BoxShape3D_1"]
size = Vector3(1, 1, 1)

[node name="Casts" type="Node3D"]

[node name="Ray" type="RayCast3D" parent="."]
target_position = Vector3(0, -3, 0)

[node name="Cast" type="ShapeCast3D" parent="."]
shape = SubResource("BoxShape3D_1")
target_position = Vector3(0, -2, 0)
`;

const MAIN_SCENE = `[gd_scene load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://casts.tscn" id="1_casts"]

[sub_resource type="BoxShape3D" id="BoxShape3D_own"]
size = Vector3(1, 1, 1)

[node name="Root" type="Node3D"]

[node name="Locked" parent="." instance=ExtResource("1_casts")]

[node name="Own" type="Node3D" parent="."]

[node name="Ray" type="RayCast3D" parent="Own"]

[node name="Cast" type="ShapeCast3D" parent="Own"]
shape = SubResource("BoxShape3D_own")
`;

// The collision colour draws for an enabled cast node, whatever owns it or what is selected.
const OWN_ALPHA = DEFAULT_COLLISION_DEBUG_COLOR.a;

async function renderRoot(extraProperties = '') {
  const fake = createFakeResourceLoader();
  const parser = new TscnParser();
  fake.scenes.seed('res://casts.tscn', parser.parse(CASTS_SCENE));
  const mainScene = parser.parse(MAIN_SCENE + extraProperties);
  return ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={mainScene}>
      <NodeDispatcher nodes={mainScene.nodes} />
    </SceneStack>
  );
}

// The gizmo parts in draw order: the dispatcher mounts Locked, then its own, each the ray's line,
// the cast's sweep line and the cast's wireframe: 9 lines, then the 3 pyramid fills as meshes.
const LOCKED_RAY = 0;
const LOCKED_CAST_LINE = 1;
const LOCKED_CAST_WIRE = 2;
const OWN_RAY = 3;
const OWN_CAST_LINE = 4;
const OWN_CAST_WIRE = 5;

describe('NodeDispatcher: cast gizmos of instanced nodes', () => {
  it('draws the locked casts in the material the node owns, as the plugins fetch no variant', async () => {
    const renderer = await renderRoot();
    const opacities = lineOpacities(renderer);
    expect(opacities[LOCKED_RAY]).toBe(OWN_ALPHA);
    expect(opacities[LOCKED_CAST_LINE]).toBe(OWN_ALPHA);
    expect(opacities[LOCKED_CAST_WIRE]).toBe(OWN_ALPHA);
  });

  it('draws the casts the edited scene authored the same way', async () => {
    const renderer = await renderRoot();
    const opacities = lineOpacities(renderer);
    expect(opacities[OWN_RAY]).toBe(OWN_ALPHA);
    expect(opacities[OWN_CAST_LINE]).toBe(OWN_ALPHA);
    expect(opacities[OWN_CAST_WIRE]).toBe(OWN_ALPHA);
    // One RayCast3D pyramid per node, in the collision colour like every other part.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('draws a disabled cast in the grey the shape_material_disabled fetch returns alone', async () => {
    // A node the edited scene authors disabled, beside its enabled twin.
    const extra = `\n[node name="Sleepy" type="RayCast3D" parent="Own"]\nenabled = false\n`;
    const renderer = await renderRoot(extra);
    const materials = lineMaterials(renderer);
    const sleepy = materials[materials.length - 1]!;
    expect(sleepy.opacity).toBe(gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a));
    expect(sleepy.color.toArray()).toEqual(godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray());
  });
});
