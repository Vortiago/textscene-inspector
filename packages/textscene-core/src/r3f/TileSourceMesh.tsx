/**
 * One batched mesh for the cells of a tile layer that draw from one atlas
 * source, with the unlit 2D material of Sprite2D. It owns the source's texture load.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useResource } from '../resources/useResource';
import { buildTileGeometryArrays, type DrawableCell } from '../resources/tileset/tileGeometry';
import type { AtlasSourceModel, TileGrid } from '../resources/tileset/types';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder';
import { useCanvas2DMap } from './canvas2DTextureDecode';
import { canvasItemFacing } from './canvasItemFacing';
import { materialProgramInputs } from './materialProgramInputs';
import type { CanvasItemBlendState } from '../resources/materials/canvasitemmaterial/renderer';
import type { CanvasItemLightingProps } from './lighting2d/useCanvasItemLighting';

export interface TileSourceMeshProps {
  source: AtlasSourceModel;
  cells: readonly DrawableCell[];
  grid: TileGrid;
  /**
   * Draw order within the tile group: a TileMap's layer index or the source's
   * place among the batches. three compares the group's order first.
   */
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

export function TileSourceMesh({ source, cells, grid, renderOrder, color, opacity, name, blend, lighting }: TileSourceMeshProps) {
  const texResult = useResource<THREE.Texture>(source.texturePath ?? '', 'texture');
  const { texture: tex, defines: decodeDefines } = useCanvas2DMap(texResult.value);
  const image = tex?.image as { width?: number; height?: number } | undefined;
  const texW = image?.width;
  const texH = image?.height;

  const geometry = useMemo(() => {
    if (!texW || !texH) return null;
    const arrays = buildTileGeometryArrays(cells, source, grid, texW, texH);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(arrays.uvs, 2));
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
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
    },
    merge: [canvasItemFacing(), blend, lighting],
  });

  return (
    <mesh renderOrder={renderOrder} geometry={geometry}>
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
