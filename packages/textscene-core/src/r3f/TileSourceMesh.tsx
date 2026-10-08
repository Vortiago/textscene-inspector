/**
 * One batched mesh for a run of tile cells that draw from one atlas source, with the
 * unlit 2D material of Sprite2D. It owns the source's texture load.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useResource } from '../resources/useResource';
import { buildTileGeometryArrays } from '../resources/tileset/tileGeometry';
import type { DrawableCell } from '../resources/tileset/drawableCell';
import type { AtlasSourceModel, TileGrid } from '../resources/tileset/types';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder';
import { useCanvas2DTexture } from './canvas2DTextureDecode';
import { CANVAS_SRGB_DEFINES } from './canvasSrgbMultiply';
import { canvasItemFacing } from './canvasItemFacing';
import { materialProgramInputs } from './materialProgramInputs';
import type { CanvasItemBlendState } from '../resources/materials/canvasitemmaterial/renderer';
import type { CanvasItemLightingProps } from './lighting2d/useCanvasItemLighting';

export interface TileSourceMeshProps {
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
  /** Compositing state from the node's CanvasItemMaterial, if it carries one. */
  blend?: CanvasItemBlendState;
  /** Makes the tiles sample the 2D light accumulation; empty when unlit. */
  lighting?: CanvasItemLightingProps;
}

export function TileSourceMesh({
  source,
  cells,
  grid,
  renderOrder,
  color,
  opacity,
  name,
  blend,
  lighting,
}: TileSourceMeshProps) {
  const texResult = useResource<THREE.Texture>(source.texturePath ?? '', 'texture');
  const tex = useCanvas2DTexture(texResult.value);
  const image = tex?.image as { width?: number; height?: number } | undefined;
  const texW = image?.width;
  const texH = image?.height;

  const geometry = useMemo(() => {
    if (!texW || !texH) return null;
    const arrays = buildTileGeometryArrays(cells, source, grid, texW, texH);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
    geom.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 4));
    geom.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
    return geom;
  }, [cells, source, grid, texW, texH]);
  // R3F does not dispose a geometry passed as a prop, so this releases it.
  useEffect(() => {
    if (!geometry) return;
    return () => geometry.dispose();
  }, [geometry]);

  // No texture reference or a failed load: one placeholder for the whole
  // source (the panel row comes from useResource's missing-path report).
  if (!source.texturePath || texResult.status === 'unavailable') {
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
    merge: [canvasItemFacing(), blend, lighting],
  });

  return (
    <mesh renderOrder={renderOrder} geometry={geometry}>
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
