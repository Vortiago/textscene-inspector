/**
 * One batched mesh for a run of tile cells that draw from one atlas source, with the
 * 2D material of Sprite2D. It resolves the source's texture as any Texture2D slot is resolved.
 */

import { useMemo, useState } from 'react';
import { useDisposeOnRelease } from './useDisposeOnRelease';
import * as THREE from 'three';
import { useCanvasItemTextureSampledBy } from './canvasItemTexture';
import {
  buildPaddedStandInGeometryArrays,
  buildTileGeometryArrays,
  buildTileOrientations,
} from '../resources/tileset/tileGeometry';
import type { DrawableCell } from '../resources/tileset/drawableCell';
import type { AtlasSourceModel, TileGrid } from '../resources/tileset/types';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder';
import { useCanvas2DTexture } from './canvas2DTextureDecode';
import type { CanvasItemTextureSampler } from './canvasItemTextureSampler';
import { WHITE_MODULATE, type VertexColorTint } from './canvasItemModulate';
import type { Rgba } from '../godot/math/math';
import { TILE_TEXTURE_PADDING, TILE_UV_BOUNDS_ATTRIBUTE } from './tileTexturePadding';
import { TILE_NORMAL_ORIENTATION, TILE_NORMAL_ORIENTATION_ATTRIBUTE } from './tileNormalOrientation';
import { materialProgramInputs } from './materialProgramInputs';
import { usePaddedAtlasStandIn } from './paddedAtlasStandIn';
import { useSurfacePixelMaterial } from './components/LitCanvasItemPixels';
import { CanvasItemSurfaceSource } from './canvasItemSurface';
import type { CanvasItemSurface } from './lighting2d/normalMappedLighting';

interface TileSourceMeshProps {
  source: AtlasSourceModel;
  cells: readonly DrawableCell[];
  grid: TileGrid;
  /** The run's place among the layer's runs. three compares the group's order first. */
  renderOrder: number;
  /** The tile canvas item's tint, split between the vertex colours and the material. */
  tint: VertexColorTint;
  /** Group name for the per-source missing-texture placeholder. */
  name?: string;
  /** The layer's effective filter and repeat, which a source's CanvasTexture may override. */
  sampler: CanvasItemTextureSampler;
}

export function TileSourceMesh({
  source,
  cells,
  grid,
  renderOrder,
  tint,
  name,
  sampler: layerSampler,
}: TileSourceMeshProps) {
  const texResult = useCanvasItemTextureSampledBy(layerSampler, source.texture);
  const standIn = usePaddedAtlasStandIn(texResult, source);
  const isStandIn = standIn !== null;
  const tex = useCanvas2DTexture(standIn ?? texResult.texture, texResult.sampler);
  const image = tex?.image as { width?: number; height?: number } | undefined;
  const texW = image?.width;
  const texH = image?.height;

  const { canvasTexture } = texResult;
  const hasNormalMap = Boolean(canvasTexture?.slot.normalTexture);
  const arrays = useMemo(() => {
    if (!texW || !texH) return null;
    return isStandIn
      ? buildPaddedStandInGeometryArrays(cells, source, grid, texW, texH)
      : buildTileGeometryArrays(cells, source, grid, texW, texH);
  }, [cells, source, grid, texW, texH, isStandIn]);
  const colors = useMemo(() => arrays && tintedColors(arrays.colors, tint.vertex), [arrays, tint.vertex]);
  const geometry = useMemo(() => {
    if (!arrays || !colors) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    if (arrays.uvBounds)
      geom.setAttribute(TILE_UV_BOUNDS_ATTRIBUTE, new THREE.BufferAttribute(arrays.uvBounds, 4));
    geom.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
    return geom;
  }, [arrays, colors]);
  // R3F does not dispose a geometry passed as a prop, so this releases it.
  useDisposeOnRelease(geometry);
  const orientsNormals = useOrientationAttribute(geometry, hasNormalMap, cells, source);

  // The run's own maps, so runs of one tile item from different sources each light with theirs.
  const [surface, setSurface] = useState<CanvasItemSurface | null>(null);
  // A source with no texture draws nothing (`tile_map_layer.cpp:724`), nor does a pending or failed one.
  const isDrawn = source.texture !== null && !texResult.missing && tex !== null && geometry !== null;
  const pixelMaterial = useSurfacePixelMaterial(surface, isDrawn);

  if (!source.texture) return null;
  // A failed load gets one placeholder for the whole source (the panel row comes from the
  // resolver's missing report).
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
      color: tint.color,
      opacity: tint.opacity,
      // Each tile's `modulate`, multiplied onto its pixels (`tile_map_layer.cpp:2690`) in sRGB.
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      defines: tint.defines,
    },
    merge: [
      pixelMaterial,
      // A stand-in samples padded regions, so only the atlas itself holds samples inside each tile.
      source.usesTexturePadding && !isStandIn ? { injection: TILE_TEXTURE_PADDING } : undefined,
      surface && orientsNormals ? { injection: TILE_NORMAL_ORIENTATION } : undefined,
    ],
  });

  return (
    <>
      <mesh renderOrder={renderOrder} geometry={geometry}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
      {hasNormalMap && canvasTexture && (
        <CanvasItemSurfaceSource
          slot={canvasTexture.slot}
          sampler={canvasTexture.sampler}
          onSurface={setSurface}
        />
      )}
    </>
  );
}

/**
 * Adds each tile's orientation to `geometry` while the source names a normal map, and removes it
 * otherwise, so a normal map that comes or goes rebuilds no other attribute. Answers whether the
 * geometry holds it.
 */
function useOrientationAttribute(
  geometry: THREE.BufferGeometry | null,
  isNormalMapped: boolean,
  cells: readonly DrawableCell[],
  source: AtlasSourceModel
): boolean {
  return useMemo(() => {
    if (!geometry) return false;
    if (!isNormalMapped) {
      geometry.deleteAttribute(TILE_NORMAL_ORIENTATION_ATTRIBUTE);
      return false;
    }
    const orientations = buildTileOrientations(cells, source);
    geometry.setAttribute(TILE_NORMAL_ORIENTATION_ATTRIBUTE, new THREE.BufferAttribute(orientations, 1));
    return true;
  }, [geometry, isNormalMapped, cells, source]);
}

/** Each tile's `modulate` with the rgb of `vertexTint` multiplied in, or the colours as built under white. */
function tintedColors(colors: Float32Array, vertexTint: Rgba): Float32Array {
  if (vertexTint === WHITE_MODULATE) return colors;
  const { r, g, b } = vertexTint;
  const factors = [r, g, b, 1];
  return colors.map((value, index) => value * (factors[index % 4] ?? 1));
}
