/**
 * An Environment's Texture2D slots, the PanoramaSkyMaterial `panorama` and the `glow_map`, resolve a
 * ViewportTexture against the local scene of the node whose property holds the Environment. Godot
 * sets the ViewportTexture up only when every holder from that property down to it is local to scene
 * (`packed_scene.cpp:701-704`, `core/io/resource.cpp:497-503`), and samples the placeholder otherwise
 * (`viewport.cpp:168-173`). Markers stand in for the layer and the compositor, which capture what
 * the world draws with; their own tests draw it.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import type { ParsedResource } from '../../../parser/parsedResource';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { usePassToneMap } from '../../../r3f/environment/passToneMap';
import type { EnvironmentLayerProps } from '../../../r3f/environment/EnvironmentLayer';
import { unconfiguredViewportTexture } from '../../../resources/textures/viewporttexture/unconfiguredViewportTexture';

import '../../../r3f/nodes/index';

vi.mock('../../../r3f/environment/EnvironmentLayer', () => ({
  EnvironmentLayer: ({ panorama }: EnvironmentLayerProps) => (
    <group name="EnvironmentLayer" userData={{ panorama }} />
  ),
  DrawnEnvironmentLayer: ({ panorama }: EnvironmentLayerProps) => (
    <group name="DrawnEnvironmentLayer" userData={{ panorama }} />
  ),
}));
vi.mock('../../../r3f/environment/Compositor', () => ({
  Compositor: function Compositor() {
    const { glowMap } = usePassToneMap();
    return <group name="Compositor" userData={{ glowMap }} />;
  },
}));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const LOCAL = 'resource_local_to_scene = true\n';

/** A 3D SubViewport at `SubViewport`, below the scene root, as the target the slots name. */
const TARGET = `[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(64, 64)

[node name="Subject" type="MeshInstance3D" parent="SubViewport"]
mesh = SubResource("BoxMesh_1")
`;

/** Which of the panorama's holders write `resource_local_to_scene = true`. */
interface PanoramaHolders {
  environment: boolean;
  sky: boolean;
  material: boolean;
}

const EVERY_HOLDER: PanoramaHolders = { environment: true, sky: true, material: true };

function panoramaScene(holders: PanoramaHolders): string {
  return `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("SubViewport")

[sub_resource type="PanoramaSkyMaterial" id="Pano_1"]
${holders.material ? LOCAL : ''}panorama = SubResource("ViewportTexture_1")

[sub_resource type="Sky" id="Sky_1"]
${holders.sky ? LOCAL : ''}sky_material = SubResource("Pano_1")

[sub_resource type="Environment" id="Env_1"]
${holders.environment ? LOCAL : ''}background_mode = 2
sky = SubResource("Sky_1")

[node name="Root" type="Node3D"]

${TARGET}
[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Env_1")
`;
}

function glowMapScene(isEnvironmentLocal: boolean): string {
  return `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("SubViewport")

[sub_resource type="Environment" id="Env_1"]
${isEnvironmentLocal ? LOCAL : ''}glow_enabled = true
glow_map = SubResource("ViewportTexture_1")
glow_map_strength = 1.0

[node name="Root" type="Node3D"]

${TARGET}
[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Env_1")
`;
}

async function renderScene(source: string, files: Record<string, ParsedResource> = {}): Promise<Renderer> {
  const parsed = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  for (const [path, resource] of Object.entries(files)) fake.resources.seed(path, resource);
  const tree = (
    <SceneStack workspace="3d" loader={fake.loader} scene={parsed}>
      <ViewportTextureProvider>
        <WorldEnvironmentScope world="root">
          <NodeDispatcher nodes={parsed.nodes} />
        </WorldEnvironmentScope>
      </ViewportTextureProvider>
    </SceneStack>
  );
  const renderer = await ReactThreeTestRenderer.create(tree);
  // A second pass, so a target published after the first commit and a seeded file both land.
  await renderer.update(tree);
  return renderer;
}

function drawnPanorama(renderer: Renderer, layerName = 'EnvironmentLayer'): THREE.Texture | null | undefined {
  const layer = renderer.scene.find((node) => node.props.name === layerName);
  return layer.props.userData.panorama;
}

function drawnGlowMap(renderer: Renderer): THREE.Texture | null | undefined {
  const compositor = renderer.scene.find((node) => node.props.name === 'Compositor');
  return compositor.props.userData.glowMap;
}

describe('WorldEnvironment: a panorama ViewportTexture', () => {
  it('samples the decoded view of the live target when every holder is local to scene', async () => {
    const renderer = await renderScene(panoramaScene(EVERY_HOLDER));
    expect(drawnPanorama(renderer)?.name).toBe('SubViewport::target');
  });

  it.each<[string, PanoramaHolders]>([
    ['the Environment', { ...EVERY_HOLDER, environment: false }],
    ['the Sky', { ...EVERY_HOLDER, sky: false }],
    ['the PanoramaSkyMaterial', { ...EVERY_HOLDER, material: false }],
  ])('samples the placeholder when %s is not local to scene', async (_holder, holders) => {
    const renderer = await renderScene(panoramaScene(holders));
    expect(drawnPanorama(renderer)).toBe(unconfiguredViewportTexture());
  });
});

describe('WorldEnvironment: a glow map ViewportTexture', () => {
  it('samples the raw view of the live target under an Environment local to scene', async () => {
    const renderer = await renderScene(glowMapScene(true));
    expect(drawnGlowMap(renderer)?.name).toBe('SubViewport::target::plain');
  });

  it('samples the placeholder under an Environment that is not local to scene', async () => {
    const renderer = await renderScene(glowMapScene(false));
    expect(drawnGlowMap(renderer)).toBe(unconfiguredViewportTexture());
  });
});

describe('An Environment saved as a .tres', () => {
  function tresScene(): string {
    return `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[ext_resource type="Environment" path="res://environment.tres" id="1_env"]

[node name="Root" type="Node3D"]

${TARGET}
[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = ExtResource("1_env")
`;
  }

  /** The `.tres` holds the panorama chain, each holder's flag written in the file that declares it. */
  function environmentFile(isEnvironmentLocal: boolean): ParsedResource {
    const local = { resource_local_to_scene: 'true' };
    return {
      resourceType: 'Environment',
      properties: {
        ...(isEnvironmentLocal ? local : {}),
        background_mode: '2',
        sky: 'SubResource("Sky_1")',
      },
      extResources: [],
      subResources: [
        {
          id: 'ViewportTexture_1',
          type: 'ViewportTexture',
          data: { viewport_path: 'NodePath("SubViewport")' },
        },
        {
          id: 'Pano_1',
          type: 'PanoramaSkyMaterial',
          data: { ...local, panorama: 'SubResource("ViewportTexture_1")' },
        },
        { id: 'Sky_1', type: 'Sky', data: { ...local, sky_material: 'SubResource("Pano_1")' } },
      ],
    };
  }

  it('samples the live target when every holder in the file is local to scene', async () => {
    const renderer = await renderScene(tresScene(), { 'res://environment.tres': environmentFile(true) });
    expect(drawnPanorama(renderer)?.name).toBe('SubViewport::target');
  });

  it('samples the placeholder when the file does not mark the Environment local to scene', async () => {
    const renderer = await renderScene(tresScene(), { 'res://environment.tres': environmentFile(false) });
    expect(drawnPanorama(renderer)).toBe(unconfiguredViewportTexture());
  });
});

describe('Camera3D: a panorama ViewportTexture in its own Environment', () => {
  function cameraScene(isEnvironmentLocal: boolean): string {
    return panoramaScene({ ...EVERY_HOLDER, environment: isEnvironmentLocal }).replace(
      /\[node name="WorldEnvironment"[^]*$/,
      `[node name="View" type="SubViewport" parent="."]

[node name="Camera" type="Camera3D" parent="View"]
current = true
environment = SubResource("Env_1")
`
    );
  }

  it('samples the live target when every holder is local to scene', async () => {
    const renderer = await renderScene(cameraScene(true));
    expect(drawnPanorama(renderer, 'DrawnEnvironmentLayer')?.name).toBe('SubViewport::target');
  });

  it('samples the placeholder when the Environment is not local to scene', async () => {
    const renderer = await renderScene(cameraScene(false));
    expect(drawnPanorama(renderer, 'DrawnEnvironmentLayer')).toBe(unconfiguredViewportTexture());
  });
});
