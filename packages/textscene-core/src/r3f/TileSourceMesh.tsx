/**
 * One batched mesh for a run of tile cells that draw from one atlas source, with the
 * 2D material of Sprite2D. It resolves the source's texture as any Texture2D slot is resolved.
 */

import { useMemo } from 'react';
import { useDisposeOnRelease } from './useDisposeOnRelease';
import * as THREE from 'three';
import { useTexture2D } from '../resources/useTexture2D';
import { NO_RESOURCES } from './SceneResourcesContext';
import { buildPaddedStandInGeometryArrays, buildTileGeometryArrays } from '../resources/tileset/tileGeometry';
import type { DrawableCell } from '../resources/tileset/drawableCell';
import type { AtlasSourceModel, TileGrid } from '../resources/tileset/types';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder';
import { useCanvas2DTexture } from './canvas2DTextureDecode';
import type { CanvasItemTextureSampler } from './canvasItemTextureSampler';
import { CANVAS_SRGB_DEFINES } from './canvasSrgbMultiply';
import { TILE_TEXTURE_PADDING, TILE_UV_BOUNDS_ATTRIBUTE } from './tileTexturePadding';
import { materialProgramInputs } from './materialProgramInputs';
import { usePaddedAtlasStandIn } from './paddedAtlasStandIn';
import type { CanvasItemPixelMaterial } from './components/LitCanvasItemPixels';

interface TileSourceMeshProps {
  source: AtlasSourceModel;
  cells: readonly DrawableCell[];
  grid: TileGrid;
  /** The run's place among the layer's runs. three compares the group's order first. */
  renderOrder: number;
  /** Own-pixel tint from the node's CanvasItem ritual (linear space). */
  color: THREE.Color;
  opacity: number;
  /** Group name for the per-source missing-texture placeholder. */
  name?: string;
  /** The tile canvas item's facing, blend state and light list. */
  pixelMaterial: CanvasItemPixelMaterial;
  /** The layer's effective filter and repeat, which every source of the layer samples with. */
  sampler: CanvasItemTextureSampler;
}

export function TileSourceMesh({
  source,
  cells,
  grid,
  renderOrder,
  color,
  opacity,
  name,
  pixelMaterial,
  sampler,
}: TileSourceMeshProps) {
  const slot = source.texture;
  const texResult = useTexture2D(
    slot?.ref,
    slot?.externalResources ?? NO_RESOURCES.externalResources,
    slot?.internalResources ?? NO_RESOURCES.internalResources,
    'plain',
    slot?.holders
  );
  const standIn = usePaddedAtlasStandIn(texResult, source);
  const isStandIn = standIn !== null;
  const tex = useCanvas2DTexture(standIn ?? texResult.texture, sampler);
  const image = tex?.image as { width?: number; height?: number } | undefined;
  const texW = image?.width;
  const texH = image?.height;

  const geometry = useMemo(() => {
    if (!texW || !texH) return null;
    const build = isStandIn ? buildPaddedStandInGeometryArrays : buildTileGeometryArrays;
    const arrays = build(cells, source, grid, texW, texH);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
    geom.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 4));
    if (arrays.uvBounds)
      geom.setAttribute(TILE_UV_BOUNDS_ATTRIBUTE, new THREE.BufferAttribute(arrays.uvBounds, 4));
    geom.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
    return geom;
  }, [cells, source, grid, texW, texH, isStandIn]);
  // R3F does not dispose a geometry passed as a prop, so this releases it.
  useDisposeOnRelease(geometry);

  // A source with no texture draws nothing (`tile_map_layer.cpp:724`). A failed load gets one
  // placeholder for the whole source (the panel row comes from the resolver's missing report).
  if (!slot) return null;
  if (texResult.missing) {
    return <MissingResourcePlaceholder shape="plane" name={name} />;
  }
  // Pending: render nothing, so no placeholder flashes.
  if (!tex || !geometry) return null;

  // Keyed, since the program depends on it and nothing recompiles in place
  // (`materialProgramInputs.ts`). The atlas is awaited, so it holds steady.
  const program = materialProgramInputs({
    props: {
      map: tex,
      color,
      opacity,
      // Each tile's `modulate`, multiplied onto its pixels (`tile_map_layer.cpp:2690`) in sRGB.
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      defines: CANVAS_SRGB_DEFINES,
    },
    merge: [pixelMaterial, padsInShader(source, isStandIn) ? { injection: TILE_TEXTURE_PADDING } : undefined],
  });

  return (
    <mesh renderOrder={renderOrder} geometry={geometry}>
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

/** A padded source holds each sample inside its tile in the shader, unless it samples a stand-in. */
function padsInShader(source: AtlasSourceModel, isStandIn: boolean): boolean {
  return source.usesTexturePadding && !isStandIn;
}
