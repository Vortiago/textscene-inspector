/**
 * A TileMapLayer whose atlas source draws a CanvasTexture: the layer declares itself normal-mapped
 * while the CanvasTexture names a normal map (`canvas.glsl:652-665`), and samples with the
 * CanvasTexture's own filter where it names one (`texture_storage.cpp:737`).
 */
import { describe, it, expect } from 'vitest';
import './index.r3f';
import { TileMapLayer } from './Component';
import { parseTileMapLayer } from './parser';
import { subResource } from '../../../../testing/subResource';
import * as THREE from 'three';
import {
  CANVAS_TEXTURE_REF,
  FLAT_GREY_REF,
  describeCanvasTextureItem,
  renderLitItem,
  renderOnLitCanvas,
} from '../../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { placementId } from '../../../../r3f/lighting2d/itemLightList';
import type { CanvasLightList } from '../../../../r3f/lighting2d/lightPassContext';

/** The header, then one cell at (0, 0): source 0, atlas (0, 0), alternative 0. */
const ONE_CELL = 'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)';

const TILE_SET = [
  subResource('TileSetAtlasSource', 'atlas', {
    texture: CANVAS_TEXTURE_REF,
    texture_region_size: 'Vector2i(8, 8)',
    '0:0/0': '0',
  }),
  subResource('TileSet', 'ts', { 'sources/0': 'SubResource("atlas")' }),
];

function layerNode(): TscnNode {
  const heading = { type: 'node', attributes: { type: 'TileMapLayer', name: 'L' } };
  return {
    rawProperties: {},
    name: 'L',
    type: 'TileMapLayer',
    children: [],
    properties: parseTileMapLayer(heading, { tile_set: 'SubResource("ts")', tile_map_data: ONE_CELL }),
  };
}

function render(wrapper: TscnInternalResource) {
  return renderLitItem(<TileMapLayer node={layerNode()} />, [...TILE_SET, wrapper]);
}

describeCanvasTextureItem('TileMapLayer', render);

function compiledUniforms(material: THREE.MeshBasicMaterial) {
  const shader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  material.onBeforeCompile(shader as never, null as never);
  return shader.uniforms;
}

/** Two lights kept apart, so a normal-mapped item has lights to shade. */
const LIGHT_LIST: CanvasLightList = {
  buffer: new THREE.Texture(),
  lightOnlyBuffer: new THREE.Texture(),
  shadowTintBuffer: new THREE.Texture(),
  apart: {
    buffer: new THREE.DataArrayTexture(),
    shadowTintBuffer: null,
    places: [new THREE.Vector3(10, 20, 50)],
    modes: [new THREE.Vector3(0, 0, -1)],
  },
};
const LISTS = new Map([[placementId({ lightMask: 1, z: 0, layer: 0, takenLights: null }), LIGHT_LIST]]);

/** A flat normal map of one colour, and the CanvasTexture and atlas source that draw it. */
function mappedSource(id: string, colors: string, withNormal = true): TscnInternalResource[] {
  return [
    subResource('Gradient', `Gradient_${id}`, { colors }),
    subResource('GradientTexture2D', `GradientTexture2D_${id}`, {
      gradient: `SubResource("Gradient_${id}")`,
      width: '8',
      height: '8',
    }),
    subResource('CanvasTexture', `CanvasTexture_${id}`, {
      diffuse_texture: FLAT_GREY_REF,
      ...(withNormal && { normal_texture: `SubResource("GradientTexture2D_${id}")` }),
    }),
    subResource('TileSetAtlasSource', `atlas_${id}`, {
      texture: `SubResource("CanvasTexture_${id}")`,
      texture_region_size: 'Vector2i(8, 8)',
      '0:0/0': '0',
    }),
  ];
}

/** The first texel of the normal map a mesh's program binds, or null for a program without one. */
function boundNormalTexel(mesh: THREE.Mesh): number[] | null {
  const normalMap = compiledUniforms(mesh.material as THREE.MeshBasicMaterial).uNormalMap?.value as
    THREE.DataTexture | undefined;
  return normalMap ? Array.from((normalMap.image.data as Uint8Array).slice(0, 4)) : null;
}

/** A layer with a cell of source 0 and one of source 1, each drawn from a source named by `sources`. */
async function renderTwoSources(sources: TscnInternalResource[]) {
  const twoCells =
    'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0)';
  const heading = { type: 'node', attributes: { type: 'TileMapLayer', name: 'L' } };
  const node: TscnNode = {
    rawProperties: {},
    name: 'L',
    type: 'TileMapLayer',
    children: [],
    properties: parseTileMapLayer(heading, { tile_set: 'SubResource("ts")', tile_map_data: twoCells }),
  };
  const tileSet = subResource('TileSet', 'ts', {
    'sources/0': 'SubResource("atlas_a")',
    'sources/1': 'SubResource("atlas_b")',
  });
  const canvas = await renderOnLitCanvas(<TileMapLayer node={node} />, [...sources, tileSet], LISTS);
  const meshes = canvas.renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
  return { ...canvas, meshes };
}

describe('TileMapLayer with two sources', () => {
  const RED = 'PackedColorArray(1, 0, 0, 1)';
  const GREEN = 'PackedColorArray(0, 1, 0, 1)';

  it('binds each run of one tile item to the normal map of its own source', async () => {
    const { meshes } = await renderTwoSources([...mappedSource('a', RED), ...mappedSource('b', GREEN)]);
    expect(meshes.map(boundNormalTexel)).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
    ]);
  });

  it('keeps a run whose source has no normal map on the accumulation', async () => {
    const { meshes, registerItem } = await renderTwoSources([
      ...mappedSource('a', RED),
      ...mappedSource('b', GREEN, false),
    ]);
    expect(meshes.map(boundNormalTexel)).toEqual([[255, 0, 0, 255], null]);
    expect(registerItem.mock.calls.map(([, read]) => read).sort()).toContain('plain');
  });
});
