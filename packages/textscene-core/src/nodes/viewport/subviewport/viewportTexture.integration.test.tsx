/**
 * Publisher → registry → consumer, end to end through the real dispatcher, on
 * the two scenes the offscreen subsystem is measured against.
 *
 * The unit tests either side of this one can both pass while the seam is still
 * broken: the publisher keys on the dispatcher-absolute path while
 * `viewport_path` counts from the local scene root
 * (`ViewportTexture::_setup_local_to_scene` resolves it against
 * `get_local_scene()`, and the property carries
 * `PROPERTY_USAGE_NODE_PATH_FROM_SCENE_ROOT`). Only a whole-scene mount proves
 * the two coordinate systems actually meet.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';

import '../../../r3f/nodes/index';

async function renderScene(source: string, workspace: '2d' | '3d' = '3d') {
  const parsed = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  return ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace={workspace}>
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <ViewportTextureProvider>
              <NodeDispatcher nodes={parsed.nodes} />
            </ViewportTextureProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
}

/** Every material in the rendered tree, whatever depth it sits at. */
function materials(renderer: Awaited<ReturnType<typeof renderScene>>): THREE.Material[] {
  const found: THREE.Material[] = [];
  renderer.scene.findAll(() => true).forEach((node) => {
    const material = (node.instance as THREE.Mesh).material;
    if (material) found.push(...(Array.isArray(material) ? material : [material]));
  });
  return found;
}

/** `scenes/fixtures/unit-sub-viewport-texture.tscn`, verbatim in shape. */
const UNIT_FIXTURE = `[gd_scene format=3]

[sub_resource type="QuadMesh" id="QuadMesh_1"]
size = Vector2(2, 2)

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("SubViewport")

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_1"]
resource_local_to_scene = true
shading_mode = 0
albedo_texture = SubResource("ViewportTexture_1")

[sub_resource type="SphereMesh" id="SphereMesh_1"]
radius = 0.5
height = 1.0

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(256, 256)
render_target_update_mode = 4

[node name="Subject" type="MeshInstance3D" parent="SubViewport"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -4)
mesh = SubResource("SphereMesh_1")

[node name="Camera3D" type="Camera3D" parent="SubViewport"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -2)
fov = 75.0

[node name="Screen" type="MeshInstance3D" parent="."]
mesh = SubResource("QuadMesh_1")
surface_material_override/0 = SubResource("StandardMaterial3D_1")
`;

describe('ViewportTexture end to end', () => {
  it("the quad's albedo map is the sub-viewport's published target", async () => {
    const renderer = await renderScene(UNIT_FIXTURE);
    const maps = materials(renderer)
      .map((material) => (material as THREE.MeshStandardMaterial).map)
      .filter((map): map is THREE.Texture => !!map);
    expect(maps).toHaveLength(1);
    expect(maps[0]!.name).toBe('SubViewport::target');
  });

  /**
   * Shared `World3D` (`Viewport::find_world_3d` walks up to the parent unless
   * `own_world_3d`), so Godot draws the sphere BOTH on the quad and in the main
   * view. A reference render through Godot 4.6.3 shows exactly that — it is the
   * documented default, not a bug.
   */
  it('the sub-viewport subject still draws in the main view (shared World3D)', async () => {
    const renderer = await renderScene(UNIT_FIXTURE);
    expect(renderer.scene.findAllByProps({ name: 'Subject' })).toHaveLength(1);
  });

  /**
   * `3d_in_2d.tscn`: a `Node2D` root, so the 2D workspace — where 3D content
   * never reaches the canvas — yet the Sprite2D must still show the target.
   */
  it('a Sprite2D in the 2D workspace shows the target of a 3D sub-viewport', async () => {
    const renderer = await renderScene(
      `[gd_scene format=3]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("SubViewport")

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Stage" type="Node2D"]

[node name="SubViewport" type="SubViewport" parent="."]
transparent_bg = true
size = Vector2i(300, 300)
render_target_update_mode = 4

[node name="Subject" type="MeshInstance3D" parent="SubViewport"]
mesh = SubResource("BoxMesh_1")

[node name="Camera3D" type="Camera3D" parent="SubViewport"]

[node name="ViewportSprite" type="Sprite2D" parent="."]
texture = SubResource("ViewportTexture_1")
`,
      '2d'
    );
    const maps = materials(renderer)
      .map((material) => (material as THREE.MeshBasicMaterial).map)
      .filter((map): map is THREE.Texture => !!map);
    expect(maps.map((map) => map.name)).toContain('SubViewport::target');
  });

  /**
   * The sprite's quad is sized from the TARGET rect, not from a loaded image —
   * a render target reports its size through the same `image` shape.
   */
  it('the sprite quad is sized to the sub-viewport target', async () => {
    const renderer = await renderScene(
      `[gd_scene format=3]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("SubViewport")

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Stage" type="Node2D"]

[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(300, 200)

[node name="Subject" type="MeshInstance3D" parent="SubViewport"]
mesh = SubResource("BoxMesh_1")

[node name="ViewportSprite" type="Sprite2D" parent="."]
texture = SubResource("ViewportTexture_1")
`,
      '2d'
    );
    const planes = renderer.scene
      .findAll(() => true)
      .map((node) => (node.instance as THREE.Mesh).geometry)
      .filter((geometry): geometry is THREE.PlaneGeometry =>
        (geometry as THREE.PlaneGeometry)?.type === 'PlaneGeometry'
      );
    expect(planes.some((p) => p.parameters.width === 300 && p.parameters.height === 200)).toBe(true);
  });

  /**
   * A ViewportTexture naming a node that is not there resolves to nothing. It
   * must not fall through to the file loader and paint a missing-resource
   * placeholder over a scene whose only fault is a stale path — Godot's own
   * `get_node_or_null` + `ERR_FAIL_NULL_MSG` is likewise non-fatal.
   */
  it('a ViewportTexture naming a missing viewport leaves the slot empty', async () => {
    const renderer = await renderScene(`[gd_scene format=3]

[sub_resource type="QuadMesh" id="QuadMesh_1"]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("NoSuchViewport")

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_1"]
albedo_texture = SubResource("ViewportTexture_1")

[node name="Root" type="Node3D"]

[node name="Screen" type="MeshInstance3D" parent="."]
mesh = SubResource("QuadMesh_1")
surface_material_override/0 = SubResource("StandardMaterial3D_1")
`);
    const maps = materials(renderer)
      .map((material) => (material as THREE.MeshStandardMaterial).map)
      .filter((map): map is THREE.Texture => !!map);
    expect(maps).toHaveLength(0);
  });
});
