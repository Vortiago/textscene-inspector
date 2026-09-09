/**
 * <TileSourceMesh> — ONE batched mesh for all of a tile layer's cells that draw
 * from a single atlas source. Owns the per-source texture load (placeholder UX
 * and late-arrival recovery come from useResource), builds its merged geometry
 * from the pure tileGeometry builder, and renders with the unlit 2D material
 * recipe shared with Sprite2D.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useResource } from '../resources/useResource';
import { buildTileGeometryArrays, type DrawableCell } from '../resources/tileset/tileGeometry';
import type { AtlasSourceModel, TileGrid } from '../resources/tileset/types';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder';
import type { CanvasItemBlendState } from '../resources/materials/canvasitemmaterial/renderer';
import type { CanvasItemLightingProps } from './lighting2d/useCanvasItemLighting';

export interface TileSourceMeshProps {
  source: AtlasSourceModel;
  cells: readonly DrawableCell[];
  grid: TileGrid;
  /** Local +Z offset for layer/source draw order within the node. */
  z: number;
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

export function TileSourceMesh({ source, cells, grid, z, color, opacity, name, blend, lighting }: TileSourceMeshProps) {
  const texResult = useResource<THREE.Texture>(source.texturePath ?? '', 'texture');
  const tex = texResult.value;
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
  // Passed via the `geometry` prop, which R3F does NOT auto-dispose (only
  // JSX-declared geometries are managed) — release the GPU buffers ourselves
  // when a new one replaces it / on unmount.
  useEffect(() => {
    if (!geometry) return;
    return () => geometry.dispose();
  }, [geometry]);

  // No texture reference or a failed load: one placeholder for the whole
  // source (the panel row comes from useResource's missing-path report).
  if (!source.texturePath || texResult.status === 'unavailable') {
    return <MissingResourcePlaceholder shape="plane" name={name} />;
  }
  // Pending: render nothing — no placeholder flash.
  if (!tex || !geometry) return null;

  return (
    <mesh position={[0, 0, z]} geometry={geometry}>
      <meshBasicMaterial
        map={tex}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        {...blend}
        {...lighting}
      />
    </mesh>
  );
}
