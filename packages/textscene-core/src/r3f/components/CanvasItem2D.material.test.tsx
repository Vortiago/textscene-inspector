/**
 * The CanvasItemMaterial seam: `<CanvasItem2D>` resolves a node's material once
 * — including Godot's `use_parent_material` walk up the CanvasItem chain — and
 * hands it to the slice's `body`, so no slice re-implements the rule.
 *
 * These assert the resolved blend state reaching a real rendered material,
 * through Polygon2D as the consumer. The isometric dungeon's `TopLight`
 * polygons are the motivating case: `blend_mode = 1` (Add) over a warm
 * translucent fill, which reads as an opaque khaki slab under plain MIX.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';

import '../nodes/index';

const TRI = 'PackedVector2Array(0, 0, 16, 0, 16, 16)';

async function materialsByNodeName(tscn: string): Promise<Map<string, THREE.MeshBasicMaterial>> {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  // Sprite slices draw a placeholder without a texture, which carries no blend
  // state — seed every external image the scene references.
  for (const ext of scene.externalResources) {
    if (ext.type !== 'Texture2D') continue;
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = { width: 8, height: 8 };
    fake.textures.seed(ext.path, tex);
  }
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const out = new Map<string, THREE.MeshBasicMaterial>();
  let root: THREE.Object3D | null | undefined = (
    renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> }
  ).children?.[0]?.instance;
  while (root?.parent) root = root.parent;
  root?.traverse((o) => {
    // The mesh is anonymous; its enclosing CanvasItem group carries the name.
    if ((o as THREE.Mesh).isMesh && o.parent?.name) {
      out.set(o.parent.name, (o as THREE.Mesh).material as THREE.MeshBasicMaterial);
    }
  });
  return out;
}

describe('<CanvasItem2D> CanvasItemMaterial', () => {
  it('leaves a node with no material on Godot default MIX blending', async () => {
    const mats = await materialsByNodeName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Plain" type="Polygon2D" parent="."]
polygon = ${TRI}
`);
    expect(mats.get('Plain')!.blending).toBe(THREE.NormalBlending);
  });

  it('applies additive blending from blend_mode = 1', async () => {
    const mats = await materialsByNodeName(`[gd_scene format=3]

[sub_resource type="CanvasItemMaterial" id="1"]
blend_mode = 1

[node name="Root" type="Node2D"]

[node name="TopLight" type="Polygon2D" parent="."]
material = SubResource("1")
polygon = ${TRI}
`);
    const mat = mats.get('TopLight')!;
    expect(mat.blending).toBe(THREE.CustomBlending);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('applies multiply blending from blend_mode = 3', async () => {
    const mats = await materialsByNodeName(`[gd_scene format=3]

[sub_resource type="CanvasItemMaterial" id="1"]
blend_mode = 3

[node name="Shade" type="Polygon2D" parent="."]
material = SubResource("1")
polygon = ${TRI}
`);
    const mat = mats.get('Shade')!;
    expect(mat.blendSrc).toBe(THREE.DstColorFactor);
    expect(mat.blendDst).toBe(THREE.ZeroFactor);
  });

  it('inherits the parent material when use_parent_material is set', async () => {
    const mats = await materialsByNodeName(`[gd_scene format=3]

[sub_resource type="CanvasItemMaterial" id="1"]
blend_mode = 1

[node name="Root" type="Node2D"]
material = SubResource("1")

[node name="Child" type="Polygon2D" parent="."]
use_parent_material = true
polygon = ${TRI}
`);
    expect(mats.get('Child')!.blending).toBe(THREE.CustomBlending);
    expect(mats.get('Child')!.blendDst).toBe(THREE.OneFactor);
  });

  it('does NOT inherit without use_parent_material — Godot requires the opt-in', async () => {
    const mats = await materialsByNodeName(`[gd_scene format=3]

[sub_resource type="CanvasItemMaterial" id="1"]
blend_mode = 1

[node name="Root" type="Node2D"]
material = SubResource("1")

[node name="Child" type="Polygon2D" parent="."]
polygon = ${TRI}
`);
    expect(mats.get('Child')!.blending).toBe(THREE.NormalBlending);
  });

  it('applies the blend to EVERY canvas-item slice, not just Polygon2D', async () => {
    // A blend that only reached one slice would silently mis-composite sprites,
    // lines and tilemaps while looking implemented.
    const mats = await materialsByNodeName(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://textures/sprite2d-marker.png" id="tex"]

[sub_resource type="CanvasItemMaterial" id="1"]
blend_mode = 1

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
material = SubResource("1")
texture = ExtResource("tex")

[node name="Line" type="Line2D" parent="."]
material = SubResource("1")
points = PackedVector2Array(0, 0, 32, 32)

[node name="Poly" type="Polygon2D" parent="."]
material = SubResource("1")
polygon = ${TRI}
`);
    for (const name of ['Sprite', 'Line', 'Poly']) {
      const mat = mats.get(name);
      expect(mat, `${name} should render a mesh`).toBeDefined();
      expect(mat!.blending, `${name} should blend additively`).toBe(THREE.CustomBlending);
      expect(mat!.blendDst, `${name} should blend additively`).toBe(THREE.OneFactor);
    }
  });

  it('ignores a material reference that is not a CanvasItemMaterial', async () => {
    // ShaderMaterial is unimplemented; inventing blend state for it would be
    // worse than Godot's plain default.
    const mats = await materialsByNodeName(`[gd_scene format=3]

[sub_resource type="ShaderMaterial" id="1"]

[node name="Shaded" type="Polygon2D" parent="."]
material = SubResource("1")
polygon = ${TRI}
`);
    expect(mats.get('Shaded')!.blending).toBe(THREE.NormalBlending);
  });
});
