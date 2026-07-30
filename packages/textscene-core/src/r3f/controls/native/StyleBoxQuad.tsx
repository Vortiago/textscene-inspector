/**
 * `<StyleBoxQuad>` — draws a resolved `StyleBoxFlat` (`styleBoxFlatGeometry`'s
 * output) as canvas geometry: a hand-built `BufferGeometry` attached via
 * `<primitive>` (following `Polygon2D`'s `FilledPolygon`,
 * `nodes/2d/polygon2d/Component.tsx`), painted with the house recipe every
 * flat-shaded 2D item in this codebase uses — `meshBasicMaterial`,
 * `vertexColors`, `transparent`, `depthWrite={false}`, `THREE.DoubleSide`.
 *
 * Positions pass straight through from `styleBoxFlatGeometry` (Godot pixels,
 * +Y down, no axis flip — that is the caller's job, same as every other
 * `native/` module). Vertex colours are converted sRGB → linear here (three's
 * `vertexColors` path applies no colour-space conversion of its own, unlike a
 * texture's `SRGBColorSpace` tag), using the same curve
 * `godotColor.ts`/`Polygon2D` use, just the raw-channel form
 * (`utils/colorSpace.ts`) so this stays a plain THREE-only conversion with no
 * extra per-render `THREE.Color` allocation.
 *
 * R3F does not auto-dispose a geometry passed via `attach="geometry"`
 * (`Polygon2D`'s own comment) — released on rebuild/unmount here too.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sRGBToLinearRGB } from '../../../utils/colorSpace';
import { styleBoxFlatGeometry } from './styleBoxFlatGeometry';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rect2 } from './rect';
import { useControlClipPlanes } from './controlClipping';

export interface StyleBoxQuadProps {
  styleBox: StyleBoxFlatData;
  rect: Rect2;
  /**
   * Paint order within the 2D transparent bucket. Load-bearing rather than
   * cosmetic: nothing here writes depth, so three's transparent sort — which
   * reads `renderOrder` before camera distance — is the *only* thing deciding
   * which Control covers which. A quad that drops it paints in traversal order
   * and silently ignores both `z_index` and `CanvasLayer.layer`.
   */
  renderOrder: number;
}

export function StyleBoxQuad({ styleBox, rect, renderOrder }: StyleBoxQuadProps) {
  const geometry = useMemo(() => buildGeometry(styleBox, rect), [styleBox, rect]);
  // R3F won't auto-dispose a geometry passed via `attach`; release on rebuild.
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const clippingPlanes = useControlClipPlanes();

  if (!geometry) return null;

  return (
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        vertexColors
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes as THREE.Plane[]}
      />
    </mesh>
  );
}

function buildGeometry(styleBox: StyleBoxFlatData, rect: Rect2): THREE.BufferGeometry | null {
  const { positions, indices, colors } = styleBoxFlatGeometry(styleBox, rect);
  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.setAttribute('color', new THREE.BufferAttribute(linearizeColors(colors), 4));
  return geometry;
}

/** RGBA quadruples, sRGB channels linearised, alpha passed through unchanged. */
function linearizeColors(rgba: readonly number[]): Float32Array {
  const out = new Float32Array(rgba.length);
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r, g, b] = sRGBToLinearRGB(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = rgba[i + 3]!;
  }
  return out;
}
