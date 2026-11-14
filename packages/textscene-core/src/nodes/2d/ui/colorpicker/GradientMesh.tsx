/**
 * The vertex-coloured meshes of the picker: the SV square's layers, the hue rainbow and the channel-slider bands.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useCanvasItemMerge } from '../../../../r3f/components/LitCanvasItemPixels';
import {
  useVertexColorTint,
  type OwnPixelTint,
  type VertexColorTint,
} from '../../../../r3f/canvasItemModulate';
import { materialProgramInputs } from '../../../../r3f/materialProgramInputs';
import { useDisposeOnRelease } from '../../../../r3f/useDisposeOnRelease';
import type { QuadGeometry } from './svGradient';

export function buildGeometry(g: QuadGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3));
  geometry.setIndex(g.indices);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.colors), 4));
  return geometry;
}

interface GradientMeshProps {
  geometry: THREE.BufferGeometry;
  renderOrder: number;
  clippingPlanes: THREE.Plane[];
  /** The item's tint, whose vertex factor the geometry's colours already carry. */
  tint: VertexColorTint;
}

/** One vertex-coloured, single-pass mesh: the SV square's two layers, the hue strip and every channel-slider band. */
export function GradientMesh({ geometry, renderOrder, clippingPlanes, tint }: GradientMeshProps) {
  const canvasItemMerge = useCanvasItemMerge();
  useDisposeOnRelease(geometry);
  const program = materialProgramInputs({
    props: {
      color: tint.color,
      opacity: tint.opacity,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      clippingPlanes,
      defines: tint.defines,
    },
    merge: canvasItemMerge,
  });
  return (
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

/**
 * The rendering server applies a CanvasItem's accumulated modulate to every draw call, so the
 * vertex factor of `useVertexColorTint` multiplies into each colour.
 */
export function tintVertexColors(
  colors: number[],
  tint: { r: number; g: number; b: number; a: number }
): number[] {
  const out = new Array<number>(colors.length);
  for (let i = 0; i < colors.length; i += 4) {
    out[i] = colors[i]! * tint.r;
    out[i + 1] = colors[i + 1]! * tint.g;
    out[i + 2] = colors[i + 2]! * tint.b;
    out[i + 3] = colors[i + 3]! * tint.a;
  }
  return out;
}

/** One vertex-coloured mesh at local (0, 0), with the item's tint in its colours. */
export function TintedGradient({
  layer,
  tint,
  renderOrder,
}: {
  layer: QuadGeometry;
  tint: OwnPixelTint;
  renderOrder: number;
}) {
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const vertexTint = useVertexColorTint(tint.own);
  const geometry = useMemo(
    () => buildGeometry({ ...layer, colors: tintVertexColors(layer.colors, vertexTint.vertex) }),
    [layer, vertexTint.vertex]
  );
  return (
    <GradientMesh
      geometry={geometry}
      renderOrder={renderOrder}
      clippingPlanes={clippingPlanes}
      tint={vertexTint}
    />
  );
}
