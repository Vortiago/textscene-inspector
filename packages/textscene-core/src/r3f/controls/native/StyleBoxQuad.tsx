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
 * The optional `color` prop is a CanvasItem tint (`useCanvasItemTint`'s
 * `own`, RAW sRGB, alpha included) composed into `styleBox`'s two base
 * colours INTERNALLY, via `tintStyleBox`, before that single conversion runs.
 * Unlike `ControlQuad`'s `color`/`opacity` pair (already-linear `THREE.Color`
 * + a separate alpha scalar, because a plain quad has ONE colour to hand the
 * material directly), a StyleBox has TWO base colours and this component's
 * own downstream sRGB→linear conversion — multiplying a linear tint in here
 * would double-convert, and splitting alpha into its own prop would just be
 * `color.a` twice over. One RGBA prop, multiplied pre-conversion, is the
 * correct shape for this component; passing `tint.own` from
 * `useCanvasItemTint` is the caller's whole job. Every StyleBox painter that
 * used to call `tintStyleBox` itself and hand the RESULT here can now hand
 * `color={tint.own}` and its ORIGINAL untinted `StyleBoxFlatData` instead.
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
import { multiplyModulate, WHITE_MODULATE, type RGBA } from '../../canvasItemModulate';

export interface StyleBoxQuadProps {
  styleBox: StyleBoxFlatData;
  rect: Rect2;
  /**
   * A CanvasItem tint (raw sRGB, alpha included — pass `useCanvasItemTint`'s
   * `own`, never its already-linear `color`) multiplied into `styleBox`'s
   * `bgColor`/`borderColor` BEFORE this component's single sRGB→linear
   * conversion. Defaults to opaque white (no tint), the `WHITE_MODULATE`
   * no-op `tintStyleBox` already fast-paths.
   */
  color?: RGBA;
  /**
   * Paint order within the 2D transparent bucket. Load-bearing rather than
   * cosmetic: nothing here writes depth, so three's transparent sort — which
   * reads `renderOrder` before camera distance — is the *only* thing deciding
   * which Control covers which. A quad that drops it paints in traversal order
   * and silently ignores both `z_index` and `CanvasLayer.layer`.
   */
  renderOrder: number;
}

export function StyleBoxQuad({ styleBox, rect, color, renderOrder }: StyleBoxQuadProps) {
  // Godot space → three space, once, here.
  //
  // `styleBoxFlatGeometry` is a faithful transcription of `StyleBoxFlat::draw`,
  // so it emits ABSOLUTE Godot coordinates: `rect.x`/`rect.y` are added onto
  // every vertex and +Y points down. But the walker has already translated this
  // painter's group to `[rect.x, -rect.y, 0]`, so passing the rect through
  // unchanged offsets the box a second time and mirrors it vertically.
  //
  // Only the size reaches the geometry, and the y flip is applied by a wrapping
  // group. Every Panel until now happened to be drawn at rect (0,0), where both
  // errors vanish — which is also why no test caught it.
  const size = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const tintedStyleBox = useMemo(() => tintStyleBox(styleBox, color ?? WHITE_MODULATE), [styleBox, color]);
  const geometry = useMemo(() => buildGeometry(tintedStyleBox, size), [tintedStyleBox, size]);
  // R3F won't auto-dispose a geometry passed via `attach`; release on rebuild.
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const clippingPlanes = useControlClipPlanes();

  if (!geometry) return null;

  return (
    <group scale={[1, -1, 1]}>
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
    </group>
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

/**
 * Multiplies a composed tint into a StyleBox's TWO base colours, in raw sRGB.
 *
 * `<StyleBoxQuad>`'s own `color` prop is this function applied internally —
 * still exported (and independently tested) because `styleBoxFlat.ts` sits
 * inside the solver's framework-free closure and cannot import the modulate
 * helpers, so a painter that needs a tinted StyleBox for something OTHER than
 * feeding `<StyleBoxQuad>` (there is none today, but the seam is cheap to
 * keep) still has it available directly. `styleBoxFlatGeometry` performs the
 * single sRGB→linear conversion downstream of both call sites, so multiplying
 * after that point would double-convert — invisible at tint 1, wrong
 * everywhere else.
 */
export function tintStyleBox(styleBox: StyleBoxFlatData, tint: RGBA): StyleBoxFlatData {
  if (tint.r === 1 && tint.g === 1 && tint.b === 1 && tint.a === 1) return styleBox;
  return {
    ...styleBox,
    bgColor: multiplyModulate(styleBox.bgColor, tint),
    borderColor: multiplyModulate(styleBox.borderColor, tint),
  };
}
