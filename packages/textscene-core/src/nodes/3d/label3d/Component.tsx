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
 * `boundsProxySizePx` sizes an invisible `<mesh>` by a CHEAP estimate
 * (average glyph advance × char count, no shaping, no atlas) alongside the
 * lazy-loaded real glyphs — the same `visible={false}` bounds-proxy pattern
 * `nodes/3d/csg/CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY` uses for its own
 * async-loaded content, and for the same reason: `TscnCanvas.tsx`'s
 * `CameraFit` can lock in its LAST auto-frame retry before an async mesh
 * exists at all (measured: without a synchronous stand-in, a scene framed
 * as if every Label3D caption were absent, since `React.lazy` gives
 * `frameSceneBounds` nothing to find until the glyph chunk resolves — a
 * one-shot pending-count signal is not a safe substitute, since another
 * resource's fast pending→settled transition can retire that ONE shot before
 * this label's own request even registers). `frameSceneBounds` already
 * prefers framing too LARGE over too small (its own CSG-proxy comment), so
 * an approximate estimate — never exact, since it skips real shaping — is
 * the right trade here too.
 */

import { Suspense, lazy, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Label3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { getAverageAdvancePx, getLinePitchPx } from '../../../r3f/controls/native/text/openSansMetrics';

const LabelGlyphs = lazy(() => import('./LabelGlyphs'));

/** Marks the invisible bounds proxy — mirrors `CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY`, see this file's own doc. */
export const LABEL3D_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

/**
 * A same-order-of-magnitude (text.length × average glyph advance) stand-in
 * for the real shaped size, computed with NO shaping and NO atlas — the
 * average-advance metric already vendored for exactly this "no real glyph
 * data available" case (`textLayout.ts`'s `glyphAdvancePx` fallback for an
 * unbaked character; `getLinePitchPx` is the SAME per-line pitch the real
 * layout uses, shaping or not, since it depends only on `font_size`/
 * `line_spacing`). Godot px; the caller scales by `pixel_size`.
 */
function boundsProxySizePx(
  text: string,
  fontSizePx: number,
  lineSpacingPx: number
): { widthPx: number; heightPx: number } {
  const lines = text.split('\n');
  const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const widthPx = longestLineLength * getAverageAdvancePx(fontSizePx);
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
