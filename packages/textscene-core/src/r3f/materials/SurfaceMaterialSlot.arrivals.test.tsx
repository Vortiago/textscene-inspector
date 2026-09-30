/**
 * One material, three arrivals: written in the scene, a whole `.tres`, and a
 * `[sub_resource]` inside one. The slot draws each the same way, resolves each texture in
 * the material's own file, and uploads each map in bands into the program it linked first.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTresFile } from '../../parser/parsedResource';
import type { TscnInternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { fakeTiledUploads } from '../tiledUpload/fakeTiledUploads.testkit';
import type { MaterialSource } from './materialSource';
import { pendingMapStandIn } from './pendingMapStandIn';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';

const TRES_PATH = 'res://painted.tres';

/** The material body both arrivals carry, with a map that names `Ramp` in its own file. */
const MATERIAL_BODY = {
  albedo_color: 'Color(1, 0, 0, 1)',
  roughness: '0.25',
  albedo_texture: 'SubResource("Ramp")',
};

/** A gradient texture `width` pixels wide, so a map shows which file it came from. */
function ramp(width: number): TscnInternalResource[] {
  return [
    { id: 'Gradient_g', type: 'Gradient', data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' } },
    {
      id: 'Ramp',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_g")', width: String(width), height: '4' },
    },
  ];
}

const SCENE: TscnInternalResource[] = [
  ...ramp(4),
  { id: 'Mat_inline', type: 'StandardMaterial3D', data: MATERIAL_BODY },
];

const TRES = `[gd_resource type="StandardMaterial3D" format=3]

[sub_resource type="Gradient" id="Gradient_g"]
colors = PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="Ramp"]
gradient = SubResource("Gradient_g")
width = 16
height = 4

[sub_resource type="StandardMaterial3D" id="Inner"]
albedo_color = Color(1, 0, 0, 1)
roughness = 0.25
albedo_texture = SubResource("Ramp")

[resource]
albedo_color = Color(1, 0, 0, 1)
roughness = 0.25
albedo_texture = SubResource("Ramp")
`;

const ARRIVALS: Record<string, MaterialSource> = {
  inline: {
    kind: 'inline',
    material: { resource: SCENE[2]!, internalResources: SCENE, externalResources: [] },
  },
  '.tres': { kind: 'file', path: TRES_PATH },
  '.tres::sub': { kind: 'file', path: `${TRES_PATH}::Inner` },
};

async function renderSlot(source: MaterialSource) {
  const fake = createFakeResourceLoader();
  fake.resources.seed(TRES_PATH, parseTresFile(TRES));
  const uploads = fakeTiledUploads();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={SCENE} externalResources={[]}>
        <uploads.wrapper>
          <mesh>
            <boxGeometry />
            <SurfaceMaterialSlot source={source} />
          </mesh>
        </uploads.wrapper>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const material = () =>
    (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
  return { material, uploads: uploads.pending };
}

async function finishUploads(uploads: { finish(uploaded: boolean): void }[]) {
  await act(async () => {
    uploads.forEach((upload) => upload.finish(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('<SurfaceMaterialSlot> across arrivals', () => {
  it.each(Object.entries(ARRIVALS))('draws the %s material with its own scalars', async (_name, source) => {
    const { material } = await renderSlot(source);

    expect(material().color.getHex()).toBe(0xff0000);
    expect(material().roughness).toBeCloseTo(0.25, 5);
  });

  it.each(Object.entries(ARRIVALS))('uploads the %s material\'s map in bands before drawing it', async (_name, source) => {
    const { material, uploads } = await renderSlot(source);
    expect(material().map).toBe(pendingMapStandIn('albedo_texture'));
    expect(uploads).toHaveLength(1);

    await finishUploads(uploads);
    expect(material().map).not.toBe(pendingMapStandIn('albedo_texture'));
    expect(material().map).toBeInstanceOf(THREE.Texture);
  });

  it.each(Object.entries(ARRIVALS))('keeps the %s material, and so its program, when the map lands', async (_name, source) => {
    const { material, uploads } = await renderSlot(source);
    const linked = material();

    await finishUploads(uploads);
    expect(material()).toBe(linked);
  });

  it('resolves a .tres material\'s map in the .tres, not in the scene with the same id', async () => {
    const fromFile = await renderSlot(ARRIVALS['.tres']!);
    const fromScene = await renderSlot(ARRIVALS.inline!);
    await finishUploads(fromFile.uploads);
    await finishUploads(fromScene.uploads);

    expect((fromFile.material().map?.image as { width: number }).width).toBe(16);
    expect((fromScene.material().map?.image as { width: number }).width).toBe(4);
  });
});
