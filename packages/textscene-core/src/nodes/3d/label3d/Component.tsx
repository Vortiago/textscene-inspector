/**
 * <Label3D> — glyph-quad text on a billboard-able group in 3D space, drawn
 * through the SAME vendored MSDF Open Sans atlas + shaping engine
 * (`r3f/controls/native/text/`) the native 2D Control Label uses
 * (`nodes/2d/ui/label/Component.tsx`) — Godot's actual default-theme font,
 * not a host system font, so a Label3D's glyphs can no longer drift from a
 * Control's on a host with a different font-substitution chain.
 *
 * The glyph-drawing pass (`LabelGlyphs`) is `React.lazy`-loaded: it, and
 * everything it imports (the shaping engine, the ~300KB vendored atlas),
 * has no business in the initial render bundle. `nodes/viewport/subviewport/
 * ControlRasterLayer.tsx` documents the same split for the same reason; this
 * file itself imports nothing from that engine, so it stays out of the
 * static closure `r3f/nodes/index.ts` pulls eagerly.
 *
 * `pixel_size` (world units per Godot glyph-pixel) is a nested `<group>`
 * scale rather than baked into geometry: `LabelGlyphs`'/`TextRun`'s geometry
 * is already in Godot px (the SAME space the 2D Control text engine draws
 * in), so converting to world units is one more transform level, the same
 * role `nodeTransform.ts`'s own scale plays for the node's authored
 * transform.
 *
 * `boundsProxySizePx` sizes an invisible `<mesh>` alongside the lazy-loaded
 * real glyphs — the same `visible={false}` bounds-proxy pattern
 * `nodes/3d/csg/CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY` uses for its own
 * async-loaded content, and for the same reason: `TscnCanvas.tsx`'s
 * `CameraFit` can lock in its LAST auto-frame retry before an async mesh
 * exists at all (measured: without a synchronous stand-in, a scene framed
 * as if every Label3D caption were absent, since `React.lazy` gives
 * `frameSceneBounds` nothing to find until the glyph chunk resolves — a
 * one-shot pending-count signal is not a safe substitute, since another
 * resource's fast pending→settled transition can retire that ONE shot before
 * this label's own request even registers). `frameSceneBounds` already
 * prefers framing too LARGE over too small (its own CSG-proxy comment), but
 * "too large" still has to be reasonably close: a flat text.length × average
 * advance first cut (this file's own earlier version) measurably over-widened
 * scenes where the label's own extent — not a large mesh alongside it —
 * dominates the union (`unit-material-heightmap.tscn`'s single caption
 * pulled the whole frame ~16% wider than the baseline's, since the true
 * width of a 29-char string with several spaces is nowhere near 29×the
 * font's OVERALL average advance — a space is under half that average).
 * Summing each character's OWN advance (`getGlyphAdvanceUnits`, falling back
 * to the average only for a character outside the vendored charset) is
 * `textLayout.ts`'s `glyphAdvancePx` in every respect but kerning — and
 * `openSansMetrics.ts`'s own doc notes this font's vendored charset carries
 * no kerning pairs at all, so the two are the SAME number for every Label3D
 * this renderer ships. `getLinePitchPx` is the SAME per-line pitch the real
 * layout uses too, shaping or not, since it depends only on `font_size`/
 * `line_spacing`. Godot px; the caller scales by `pixel_size`.
 */

import { Suspense, lazy, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Label3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import {
  getAverageAdvancePx,
  getGlyphAdvanceUnits,
  getLinePitchPx,
  OPEN_SANS_METRICS,
} from '../../../r3f/controls/native/text/openSansMetrics';

const LabelGlyphs = lazy(() => import('./LabelGlyphs'));

/** Marks the invisible bounds proxy — mirrors `CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY`, see this file's own doc. */
export const LABEL3D_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

/** One character's advance, Godot px — `textLayout.ts`'s `glyphAdvancePx` minus kerning (this file's own doc says why that is a no-op here). */
function glyphAdvancePxNoKerning(ch: string, fontSizePx: number): number {
  const units = getGlyphAdvanceUnits(ch);
  if (units === null) return getAverageAdvancePx(fontSizePx);
  return units * (fontSizePx / OPEN_SANS_METRICS.unitsPerEm);
}

/** Sums each character's own advance — the real shaped width for this font (see this file's own doc on kerning). */
function lineWidthPx(line: string, fontSizePx: number): number {
  let width = 0;
  for (const ch of line) width += glyphAdvancePxNoKerning(ch, fontSizePx);
  return width;
}

function boundsProxySizePx(
  text: string,
  fontSizePx: number,
  lineSpacingPx: number
): { widthPx: number; heightPx: number } {
  const lines = text.split('\n');
  const widthPx = lines.reduce((max, line) => Math.max(max, lineWidthPx(line, fontSizePx)), 0);
  const heightPx = lines.length * getLinePitchPx(fontSizePx, lineSpacingPx);
  return { widthPx, heightPx };
}

export function Label3D({ node, children }: NodeComponentProps) {
  const { showLabels } = useViewportMode();
  const properties = node.properties as Label3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const groupRef = useRef<THREE.Group | null>(null);

  // The pre-migration imperative renderer turned each Label3D per frame via
  // `TscnRenderer.updateLabels()`; `useBillboard` is that behaviour, shared
  // with Sprite3D so both slices implement Godot's modes identically.
  useBillboard(groupRef, properties.billboard);

  const proxy = useMemo(
    () => boundsProxySizePx(properties.text, properties.font_size, properties.line_spacing),
    [properties.text, properties.font_size, properties.line_spacing]
  );

  // On by default to match Godot (ADR-0008 point 4 superseded — see its
  // amendment note); the Labels toggle can hide it. When off, render an
  // invisible marker group so the node still positions any children and
  // stays selectable.
  if (!showLabels) {
    return (
      <group name={node.name} position={position} rotation={rotation} scale={scale}>
        {children}
      </group>
    );
  }

  return (
    <>
      <group
        ref={groupRef}
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        userData={{ billboardMode: properties.billboard, isLabel3D: true }}
      >
        {proxy.widthPx > 0 && proxy.heightPx > 0 && (
          <mesh visible={false} userData={LABEL3D_BOUNDS_PROXY}>
            <planeGeometry
              args={[proxy.widthPx * properties.pixel_size, proxy.heightPx * properties.pixel_size]}
            />
          </mesh>
        )}
        <group scale={properties.pixel_size}>
          <Suspense fallback={null}>
            <LabelGlyphs properties={properties} />
          </Suspense>
        </group>
      </group>
      {/* Descendants sit in a SIBLING group carrying the same transform, not
          inside the label's own group: `billboard` rewrites the group's
          quaternion every frame, and in Godot that is a shader-side effect
          on the label itself — it never spins the node's children. */}
      {children === undefined ? null : (
        <group position={position} rotation={rotation} scale={scale}>
          {children}
        </group>
      )}
    </>
  );
}
