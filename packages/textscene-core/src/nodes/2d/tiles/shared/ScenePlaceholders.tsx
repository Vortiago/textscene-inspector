/**
 * The editor's placeholder discs for a tile layer's scene tiles, drawn as a gizmo while the Gizmos
 * toggle is on. Godot draws them in a child canvas item of the layer (`tile_map_layer.cpp:157-166`),
 * so the layer's inherited modulate tints them. The gizmo layer draws above every canvas item, as
 * that item's top z_index does.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { GizmoMesh } from '../../../../r3f/components/GizmoMesh';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useShowGizmos } from '../../../../r3f/contexts/ViewportModeContext';
import type { Rgba } from '../../../../godot/math/math';
import type { SceneTileCell } from '../../../../resources/tileset/sceneTileCells';
import {
  PLACEHOLDER_SEGMENTS,
  placeholderCircles,
  type PlaceholderCircle,
} from '../../../../resources/tileset/scenePlaceholder';
import type { TileGrid } from '../../../../resources/tileset/types';

interface ScenePlaceholdersProps {
  grid: TileGrid;
  tiles: readonly SceneTileCell[];
  /** The layer's inherited modulate: the product the canvas applies to a child item. */
  modulate: Rgba;
}

export function ScenePlaceholders({ grid, tiles, modulate }: ScenePlaceholdersProps) {
  const showGizmos = useShowGizmos();
  const colorGroups = useMemo(
    () => (showGizmos ? circlesByColor(placeholderCircles(grid, tiles)) : []),
    [showGizmos, grid, tiles]
  );
  return colorGroups.map((circles) => (
    <PlaceholderDiscs key={colorKey(circles[0]!.color)} circles={circles} modulate={modulate} />
  ));
}

const colorKey = ({ r, g, b }: Rgba): string => `${r},${g},${b}`;

/** One mesh per colour: the gizmo mesh takes a single colour. Two cells share one when their ids hash alike. */
function circlesByColor(circles: readonly PlaceholderCircle[]): PlaceholderCircle[][] {
  const groups = new Map<string, PlaceholderCircle[]>();
  for (const circle of circles) {
    const key = colorKey(circle.color);
    const group = groups.get(key);
    if (group) group.push(circle);
    else groups.set(key, [circle]);
  }
  return [...groups.values()];
}

function PlaceholderDiscs({ circles, modulate }: { circles: readonly PlaceholderCircle[]; modulate: Rgba }) {
  const geometry = useMemo(() => discsGeometry(circles), [circles]);
  const tinted = multiplyModulate(circles[0]!.color, modulate);
  return <GizmoMesh geometry={geometry} color={useGodotLinearColor(tinted)} alpha={tinted.a} />;
}

/**
 * Each disc as `canvas_item_add_ellipse`'s fan (`renderer_canvas_cull.cpp:1436-1469`): a centre and
 * `PLACEHOLDER_SEGMENTS + 1` rim points, with the Y negated into three's frame.
 */
function discsGeometry(circles: readonly PlaceholderCircle[]): THREE.BufferGeometry {
  const rimPoints = PLACEHOLDER_SEGMENTS + 1;
  const verticesPerDisc = rimPoints + 1;
  const positions = new Float32Array(circles.length * verticesPerDisc * 3);
  const indices = new Uint32Array(circles.length * PLACEHOLDER_SEGMENTS * 3);
  circles.forEach(({ center, radius }, discIndex) => {
    const first = discIndex * verticesPerDisc;
    for (let i = 0; i < rimPoints; i++) {
      const angle = (i * Math.PI * 2) / PLACEHOLDER_SEGMENTS;
      const at = (first + i) * 3;
      positions[at] = center.x + Math.cos(angle) * radius;
      positions[at + 1] = -(center.y + Math.sin(angle) * radius);
    }
    const centerAt = (first + rimPoints) * 3;
    positions[centerAt] = center.x;
    positions[centerAt + 1] = -center.y;
    for (let i = 0; i < PLACEHOLDER_SEGMENTS; i++) {
      const at = (discIndex * PLACEHOLDER_SEGMENTS + i) * 3;
      indices[at] = first + rimPoints;
      indices[at + 1] = first + i;
      indices[at + 2] = first + i + 1;
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}
