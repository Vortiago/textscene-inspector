/**
 * `useTexture2D` — one answer for "what texture does this Texture2D slot hold?".
 *
 * The case that motivated it: every PointLight2D in the vendored isometric
 * dungeon uses a `GradientTexture2D` sub-resource for its cookie. That is
 * described entirely inside the scene, so the path-based resolver returns
 * nothing for it and all 23 lights fell back to a missing-resource placeholder,
 * even though a faithful rasteriser for it already existed — reachable only
 * from MeshInstance3D.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { NodeDispatcher } from '../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../r3f/contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';

import '../r3f/nodes/index';

/** A PointLight2D whose cookie is an inline radial GradientTexture2D. */
const LIGHT_WITH_GRADIENT_COOKIE = `[gd_scene format=3]

[sub_resource type="Gradient" id="g"]
offsets = PackedFloat32Array(0.0111732, 0.636872)
colors = PackedColorArray(0.648926, 0.648926, 0.648926, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="t"]
gradient = SubResource("g")
width = 64
height = 64
fill = 1
fill_from = Vector2(0.5, 0.5)

[node name="Root" type="Node2D"]

[node name="Torch" type="PointLight2D" parent="."]
color = Color(1, 0.466667, 0.0352941, 1)
energy = 2.0
texture = SubResource("t")
`;

/**
 * The cookie a light quad actually samples. A PointLight2D emits Godot's light
 * term through a ShaderMaterial rather than painting a textured quad on the
 * canvas, so the texture arrives as the `uCookie` uniform, not as `map`.
 */
function cookieOf(mesh: unknown): THREE.Texture | undefined {
  const material = (mesh as THREE.Mesh).material as THREE.ShaderMaterial;
  return material.uniforms?.uCookie?.value as THREE.Texture | undefined;
}

async function render(tscn: string) {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
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
  return renderer;
}

describe('useTexture2D — procedural cookies reach 2D canvas items', () => {
  it('gives a PointLight2D its GradientTexture2D cookie instead of a placeholder', async () => {
    const renderer = await render(LIGHT_WITH_GRADIENT_COOKIE);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(0);

    // The placeholder is a magenta plane with no cookie at all; the real light
    // quad samples the rasterised gradient.
    const cookie = cookieOf(meshes[0]!.instance);
    expect(cookie).toBeInstanceOf(THREE.DataTexture);
    expect(cookie!.image.width).toBe(64);
    expect(cookie!.image.height).toBe(64);
  });

  it('rasterises ONE texture for every node pointing at the same gradient', async () => {
    // A scene aims many nodes at one cookie; a copy per consumer costs
    // width x height x 4 bytes and a GPU upload each time.
    const renderer = await render(`[gd_scene format=3]

[sub_resource type="Gradient" id="g"]
offsets = PackedFloat32Array(0, 1)
colors = PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="t"]
gradient = SubResource("g")
width = 32
height = 32

[node name="Root" type="Node2D"]

[node name="A" type="PointLight2D" parent="."]
texture = SubResource("t")

[node name="B" type="PointLight2D" parent="."]
texture = SubResource("t")

[node name="C" type="PointLight2D" parent="."]
texture = SubResource("t")
`);
    const cookies = renderer.scene.findAllByType('Mesh').map((m) => cookieOf(m.instance));
    expect(cookies).toHaveLength(3);
    expect(new Set(cookies).size).toBe(1);
  });

  it('keeps the shared texture usable after one consumer unmounts', async () => {
    // The cache owns it; a consumer that disposed on unmount would leave the
    // others sampling a freed buffer.
    const first = await render(LIGHT_WITH_GRADIENT_COOKIE);
    const shared = cookieOf(first.scene.findAllByType('Mesh')[0]!.instance)!;
    await first.unmount();

    const second = await render(LIGHT_WITH_GRADIENT_COOKIE);
    const after = cookieOf(second.scene.findAllByType('Mesh')[0]!.instance)!;
    expect(after.image).toBeTruthy();
    expect(shared.image).toBeTruthy();
  });

  it('still resolves a plain image reference through the async loader', async () => {
    const fake = createFakeResourceLoader();
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = {
      width: 8,
      height: 8,
    };
    fake.textures.seed('res://cookie.png', tex);
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://cookie.png" id="1"]

[node name="Root" type="Node2D"]

[node name="Torch" type="PointLight2D" parent="."]
texture = ExtResource("1")
`);
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
    expect(cookieOf(renderer.scene.findAllByType('Mesh')[0]!.instance)).toBe(tex);
  });
});
