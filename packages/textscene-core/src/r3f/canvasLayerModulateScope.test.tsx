/**
 * An ancestor's `modulate` does not reach into a `CanvasLayer` subtree, on the
 * Control or the Node2D path. `get_parent_item()` is null under a layer
 * (`scene/main/canvas_item.cpp:565`), and the child attaches to the layer's canvas
 * (`canvas_item.cpp:264,269`), whose roots start white.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';

import './nodes/index';
import './controls/index';

/**
 * Both families at once: a `Control` carrying `modulate` above a `CanvasLayer`
 * with a `ColorRect` child, and a `Node2D` carrying `modulate` above a second
 * `CanvasLayer` with a `Polygon2D` child. Polygon2D draws from inline points,
 * so no resource load decides whether its mesh exists.
 */
const SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="TintedControl" type="Control" parent="."]
modulate = Color(0.5, 0.5, 0.5, 1)
offset_right = 640.0
offset_bottom = 400.0

[node name="ControlLayer" type="CanvasLayer" parent="TintedControl"]

[node name="Fill" type="ColorRect" parent="TintedControl/ControlLayer"]
offset_right = 64.0
offset_bottom = 64.0
color = Color(1, 1, 1, 1)

[node name="TintedNode2D" type="Node2D" parent="."]
modulate = Color(0.5, 0.5, 0.5, 1)

[node name="Node2DLayer" type="CanvasLayer" parent="TintedNode2D"]

[node name="Blob" type="Polygon2D" parent="TintedNode2D/Node2DLayer"]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
color = Color(1, 1, 1, 1)
`;

async function renderScene(): Promise<THREE.Object3D | null> {
  const parsed = new TscnParser().parse(SCENE);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={parsed.nodes} />
            <ControlCanvasLayer nodes={parsed.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  return root ?? null;
}

/** Every drawn mesh's material colour, keyed by the nearest named ancestor. */
function meshColorUnder(root: THREE.Object3D, ancestorName: string): THREE.Color | null {
  let host: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (o.name === ancestorName) host = o;
  });
  if (!host) return null;
  let color: THREE.Color | null = null;
  (host as THREE.Object3D).traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (color === null && mesh.isMesh) {
      const material = mesh.material as THREE.MeshBasicMaterial;
      if (material.color) color = material.color;
    }
  });
  return color;
}

// Roots start white (`servers/rendering/renderer_canvas_cull.cpp:82`), and modulate
// accumulates along the item-parent chain alone (`renderer_canvas_cull.cpp:326`).
// Visibility crosses only because `scene/main/canvas_layer.cpp:57-63` propagates it
// by hand. There is no colour equivalent.
describe('a CanvasLayer severs the inherited modulate chain', () => {
  // One scene carries both families, so one render answers both.
  let root: THREE.Object3D | null = null;
  beforeAll(async () => {
    root = await renderScene();
  });

  it("draws a Control-path layer child UNtinted by its Control ancestor's modulate", () => {
    expect(root).not.toBeNull();
    const color = meshColorUnder(root!, 'ColorRect:Fill');
    expect(color).not.toBeNull();
    // White, not 0.5: the layer's canvas seeds its root items at pure white.
    expect(color!.r).toBeCloseTo(1, 5);
  });

  it("draws a Node2D-path layer child UNtinted by its Node2D ancestor's modulate", () => {
    expect(root).not.toBeNull();
    const color = meshColorUnder(root!, 'Blob');
    expect(color).not.toBeNull();
    expect(color!.r).toBeCloseTo(1, 5);
  });
});
