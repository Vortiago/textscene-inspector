/**
 * Parity: TileMapLayer renders its placed cells as one batched mesh per atlas
 * source — geometry attributes from the pure builder, Sprite2D's unlit
 * material recipe, modulate sRGB→linear.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTileMapLayer } from './parser';
import { TileMapLayer } from './Component';
import { parseTresFile } from '../../../../parser/tresParser';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'TileMapLayer', name: 'Layer0' } };
const TEX = 'res://tiles.png';
const TEX2 = 'res://tiles2.png';

const externals: TscnExternalResource[] = [
  { id: '2', type: 'Texture2D', path: TEX },
  { id: '3', type: 'Texture2D', path: TEX2 },
];
const internals: TscnInternalResource[] = [
  {
    id: 'atlas1',
    type: 'TileSetAtlasSource',
    data: { id: 'atlas1', texture: 'ExtResource("2")', texture_region_size: 'Vector2i(16, 16)' },
  },
  {
    id: 'atlas2',
    type: 'TileSetAtlasSource',
    data: { id: 'atlas2', texture: 'ExtResource("3")', texture_region_size: 'Vector2i(16, 16)' },
  },
  {
    id: 'ts',
    type: 'TileSet',
    data: { id: 'ts', 'sources/0': 'SubResource("atlas1")', 'sources/1': 'SubResource("atlas2")' },
  },
];

// header(0,0) + one cell at (0,0), source 0, atlas (0,0), alternative 0.
const ONE_CELL = 'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)';

function makeNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Layer0',
    type: 'TileMapLayer',
    children: [],
    properties: parseTileMapLayer(heading, {
      tile_set: 'SubResource("ts")',
      tile_map_data: ONE_CELL,
      ...raw,
    }),
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function seededTexture(): THREE.Texture {
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 32 };
  return tex;
}

async function render(
  node: TscnNode,
  options: { missingTextures?: string[]; child?: boolean } = {}
) {
  const fake = createFakeResourceLoader();
  for (const path of [TEX, TEX2]) {
    if (options.missingTextures?.includes(path)) fake.textures.seed(path, null);
    else fake.textures.seed(path, seededTexture());
  }
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={internals} externalResources={externals}>
        <TileMapLayer node={node}>
          {options.child ? (
            <mesh name="scene-child">
              <planeGeometry />
              <meshBasicMaterial />
            </mesh>
          ) : null}
        </TileMapLayer>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('TileMapLayer render parity', () => {
  it('renders one batched mesh whose geometry and material match the builder output and sprite recipe', async () => {
    const r = await render(makeNode({ modulate: 'Color(0.5, 0.5, 0.5, 1)' }));

    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!.instance as THREE.Mesh;

    // Geometry: cell (0,0) on the 16px default grid, region (0,0,16,16) of 32×32.
    const position = mesh.geometry.getAttribute('position');
    expect(Array.from(position.array)).toEqual([0, 0, 0, 16, 0, 0, 0, -16, 0, 16, -16, 0]);
    const uv = mesh.geometry.getAttribute('uv');
    expect(Array.from(uv.array)).toEqual([0, 1, 0.5, 1, 0, 0.5, 0.5, 0.5]);

    // Material: Sprite2D's unlit recipe with the modulate tint in linear space.
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.map).toBeTruthy();
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.5), 4);
  });

  it('batches per atlas source: one mesh per source, later sources nudged forward in z', async () => {
    // header + cell (0,0) from source 0 + cell (1,0) from source 1.
    const twoSources =
      'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0)';
    const r = await render(makeNode({ tile_map_data: twoSources }));

    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(2);
    const [first, second] = meshes.map((m) => m.instance as THREE.Mesh);
    const firstMap = (first!.material as THREE.MeshBasicMaterial).map;
    const secondMap = (second!.material as THREE.MeshBasicMaterial).map;
    expect(firstMap).not.toBe(secondMap);
    expect(second!.position.z).toBeGreaterThan(first!.position.z);
  });

  it('keeps 100 cells of one source in a single batched mesh (400 vertices)', async () => {
    const bytes: number[] = [0, 0];
    for (let i = 0; i < 100; i++) {
      bytes.push(i % 10, 0, Math.floor(i / 10), 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    const r = await render(makeNode({ tile_map_data: `PackedByteArray(${bytes.join(', ')})` }));

    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!.instance as THREE.Mesh;
    expect(mesh.geometry.getAttribute('position').count).toBe(400);
    expect(mesh.geometry.index!.count).toBe(600);
  });

  it('renders no tiles when the layer is disabled', async () => {
    const r = await render(makeNode({ enabled: 'false' }));
    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('honours the TileSet grid: an isometric DIAMOND_DOWN cell lands on its map_to_local center', async () => {
    const isoInternals: TscnInternalResource[] = [
      internals[0]!,
      internals[1]!,
      {
        id: 'ts',
        type: 'TileSet',
        data: {
          id: 'ts',
          tile_shape: '1',
          tile_layout: '5',
          tile_size: 'Vector2i(128, 64)',
          'sources/0': 'SubResource("atlas1")',
        },
      },
    ];
    // header + cell (1,0) → map_to_local (128, 64) → three-local center (128, −64).
    const oneCell = 'PackedByteArray(0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)';
    const node = makeNode({ tile_map_data: oneCell });
    const fake = createFakeResourceLoader();
    fake.textures.seed(TEX, seededTexture());
    const r = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={isoInternals} externalResources={externals}>
          <TileMapLayer node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const position = mesh.geometry.getAttribute('position');
    // 16×16 region centered on (128, −64): TL = (120, −56).
    expect(Array.from(position.array).slice(0, 3)).toEqual([120, -56, 0]);
  });
});

describe('TileMapLayer with an ExtResource .tres TileSet', () => {
  const TRES_PATH = 'res://tileset.tres';
  const TILESET_TRES = `[gd_resource type="TileSet" format=3]

[ext_resource type="Texture2D" path="${TEX}" id="1"]

[sub_resource type="TileSetAtlasSource" id="Atlas_a"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)
0:0/0 = 0

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("Atlas_a")
`;
  const tresExternals: TscnExternalResource[] = [
    ...externals,
    { id: 'ts_ext', type: 'TileSet', path: TRES_PATH },
  ];

  function tresNode(): TscnNode {
    return {
      name: 'Layer0',
      type: 'TileMapLayer',
      children: [],
      properties: parseTileMapLayer(heading, {
        tile_set: 'ExtResource("ts_ext")',
        tile_map_data: ONE_CELL,
      }),
    };
  }

  function renderTres(fake: ReturnType<typeof createFakeResourceLoader>) {
    fake.textures.seed(TEX, seededTexture());
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={tresExternals}>
          <TileMapLayer node={tresNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('renders tiles when the .tres is already loaded', async () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed(TRES_PATH, parseTresFile(TILESET_TRES));
    const r = await renderTres(fake);
    expect(r.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('renders nothing while pending, then tiles on late arrival', async () => {
    const fake = createFakeResourceLoader();
    const r = await renderTres(fake);
    expect(r.scene.findAllByType('Mesh')).toHaveLength(0); // pending — no flash

    await ReactThreeTestRenderer.act(async () => {
      fake.resources._resolve(TRES_PATH, parseTresFile(TILESET_TRES));
    });
    expect(r.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('degrades to the transform-only group when the .tres fails to load', async () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed(TRES_PATH, null); // sentinel miss → unavailable
    const r = await renderTres(fake);
    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});

describe('TileMapLayer degradation (ADR-0008)', () => {
  it('undecodable tile data → transform-only group; children render, no tiles, no placeholder', async () => {
    const r = await render(makeNode({ tile_map_data: 'PackedByteArray(0, 0, 1)' }), {
      child: true,
    });
    expect(r.scene.findByProps({ name: 'scene-child' })).toBeDefined();
    expect(r.scene.findAllByType('Mesh')).toHaveLength(1); // only the scene child
  });

  it('unresolvable tile_set reference → same transform-only degradation', async () => {
    const r = await render(makeNode({ tile_set: 'SubResource("nope")' }), { child: true });
    expect(r.scene.findByProps({ name: 'scene-child' })).toBeDefined();
    expect(r.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('a missing texture degrades only its atlas source: placeholder there, other sources render', async () => {
    // Cells from source 0 (texture missing) and source 1 (texture present).
    const twoSources =
      'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0)';
    const r = await render(makeNode({ tile_map_data: twoSources }), {
      missingTextures: [TEX],
    });
    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(2);
    const colors = meshes.map((m) =>
      (m.instance.material as THREE.MeshBasicMaterial).color.getHexString()
    );
    expect(colors).toContain('ff00ff'); // the magenta per-source placeholder
    const tiled = meshes.find(
      (m) => (m.instance.material as THREE.MeshBasicMaterial).map !== null
    );
    expect(tiled).toBeDefined();
  });
});
