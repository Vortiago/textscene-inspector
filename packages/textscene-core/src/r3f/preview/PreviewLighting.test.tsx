/**
 * The preview lighting yields to the scene, per node type, independently. Scenes
 * go through the real parser and the whole `<TscnSceneContents>` tree mounts,
 * since the question is how many lights the scene ends up with.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { TscnSceneContents } from '../TscnCanvas';
import { readDirectionalShadowDeclaration } from '../directionalShadow/declaration';
import { directionalShadowBias } from '../../nodes/3d/lights/shared/shadowBias';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import { TscnParser } from '../../parser/TscnParser';
import { SOFT_LOW_QUALITY_RADIUS } from '../../godot/rendering/lights/softShadowScale';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import type { ParsedResource } from '../../parser/parsedResource';

import '../nodes/index';

// A marker stands in for the layer, whose compositor needs a real GL context.
vi.mock('../environment/NoEnvironmentLayer', () => ({
  NoEnvironmentLayer: () => <group name="NoEnvironmentLayer" />,
}));

interface RenderOptions {
  sun?: boolean;
  environment?: boolean;
  /** The `.tres` files the loader holds. A file seeded `null` failed to load, and any other loads forever. */
  files?: Record<string, ParsedResource | null>;
}

async function render(sceneText: string, { sun = true, environment = true, files = {} }: RenderOptions = {}) {
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(sceneText));
  const fake = createFakeResourceLoader();
  for (const [path, parsed] of Object.entries(files)) fake.resources.seed(path, parsed);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ViewportModeProvider initialShowPreviewSun={sun} initialShowPreviewEnvironment={environment}>
            <TscnSceneContents />
          </ViewportModeProvider>
        </SelectionProvider>
      </HierarchyProvider>
    </ResourceLoaderProvider>
  );
}

const scene = (body: string) => `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n${body}`;

const MESH = `
[node name="Cube" type="MeshInstance3D" parent="."]
`;

const DIRECTIONAL = `
[node name="Sun" type="DirectionalLight3D" parent="."]
`;

const OMNI = `
[node name="Lamp" type="OmniLight3D" parent="."]
`;

const directionalCount = (renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) =>
  renderer.scene.findAllByType('DirectionalLight').length;

describe('preview sun yielding', () => {
  it('lights a scene that brought no light of its own', async () => {
    expect(directionalCount(await render(scene(MESH)))).toBe(1);
  });

  it('steps aside for the scene’s own DirectionalLight3D', async () => {
    // One light, not two: the scene's.
    expect(directionalCount(await render(scene(DIRECTIONAL)))).toBe(1);
  });

  it('stays for a scene lit only by an OmniLight3D', async () => {
    // Godot's counter is cast_to<DirectionalLight3D>; an omni does not match,
    // and a scene lit only by a lamp keeps the preview sun.
    expect(directionalCount(await render(scene(OMNI)))).toBe(1);
  });

  it('yields once, however many directional lights the scene has', async () => {
    const renderer = await render(
      scene(`${DIRECTIONAL}\n[node name="Fill" type="DirectionalLight3D" parent="."]\n`)
    );
    expect(directionalCount(renderer)).toBe(2);
  });

  it('yields to a DirectionalLight3D that is hidden — the counter never reads `visible`', async () => {
    const renderer = await render(
      scene(`
[node name="Sun" type="DirectionalLight3D" parent="."]
visible = false
`)
    );
    expect(directionalCount(renderer)).toBe(1);
  });

  it('goes away when the user turns the preview sun off', async () => {
    expect(directionalCount(await render(scene(MESH), { sun: false }))).toBe(0);
  });
});

describe('preview environment yielding', () => {
  const WORLD_ENV = `
[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
`;

  it('leaves the preview sun alone when the scene brings a WorldEnvironment', async () => {
    // The two previews are independent counters: an environment takes away the
    // sky, never the sun. A single combined rule would leave this scene dark.
    expect(directionalCount(await render(scene(WORLD_ENV)))).toBe(1);
  });

  it('still lights a scene carrying both, with exactly the scene’s own sun', async () => {
    expect(directionalCount(await render(scene(`${DIRECTIONAL}${WORLD_ENV}`)))).toBe(1);
  });

  const noEnvironmentCount = (renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) =>
    renderer.scene.findAll((node) => node.props.name === 'NoEnvironmentLayer').length;

  it('mounts the no-Environment layer when the user turns the preview environment off', async () => {
    expect(noEnvironmentCount(await render(scene(MESH), { environment: false }))).toBe(1);
  });

  it('mounts no such layer while the preview environment draws', async () => {
    expect(noEnvironmentCount(await render(scene(MESH)))).toBe(0);
  });

  it('mounts it for a WorldEnvironment that names no Environment', async () => {
    expect(noEnvironmentCount(await render(scene(WORLD_ENV), { environment: false }))).toBe(1);
  });

  const NAMED_ENV = `[gd_scene format=3]

[ext_resource type="Environment" path="res://env.tres" id="1_env"]

[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = ExtResource("1_env")
`;

  it('mounts none while a named Environment is still loading', async () => {
    expect(noEnvironmentCount(await render(NAMED_ENV))).toBe(0);
  });

  it('mounts it for a named Environment whose .tres fails to load', async () => {
    expect(noEnvironmentCount(await render(NAMED_ENV, { files: { 'res://env.tres': null } }))).toBe(1);
  });

  // The preview environment applies itself through a GPU render the headless
  // renderer cannot run. godotPreviewLighting.test.ts covers the decision, and
  // the `preview-lighting` visual golden the pixels.
});

describe('preview sun shadow', () => {
  const previewSunDeclaration = async () => {
    const renderer = await render(scene(MESH), { environment: false });
    const sun = renderer.scene.findByType('DirectionalLight').instance as THREE.DirectionalLight;
    return readDirectionalShadowDeclaration(sun);
  };

  it('draws the editor’s four splits', async () => {
    // `node_3d_editor_plugin.cpp:10383`.
    expect((await previewSunDeclaration())?.splitCount).toBe(4);
  });

  it('keeps the class defaults for the split offsets and blending', async () => {
    expect(await previewSunDeclaration()).toMatchObject({
      splitOffsets: [0.1, 0.2, 0.5],
      blendSplits: false,
    });
  });

  it('keeps the class default fade start', async () => {
    // The editor never sets `PARAM_SHADOW_FADE_START` on its sun (`node_3d_editor_plugin.cpp:9475-9477`).
    expect((await previewSunDeclaration())?.fadeStart).toBe(0.8);
  });

  it('keeps the class default depth bias an authored sun gets', async () => {
    // The editor never sets `PARAM_SHADOW_BIAS` or `PARAM_SHADOW_BLUR` on its sun.
    expect((await previewSunDeclaration())?.depthBias).toBe(
      directionalShadowBias(undefined, SOFT_LOW_QUALITY_RADIUS)
    );
  });
});
