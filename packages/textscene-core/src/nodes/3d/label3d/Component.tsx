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
 * BOUNDS PROXY — what it is and, at length, what it is NOT:
 *
 * `frameSceneBounds.ts` (auto-fit on load, F-to-frame) unions every rendered
 * Mesh's world AABB. Because `LabelGlyphs` is lazy, a fresh Label3D has
 * nothing in the scene graph for that union to find until the atlas chunk
 * resolves — measured: without a synchronous stand-in, a scene framed as if
 * every Label3D caption were simply absent, since `CameraFit`'s last retry
 * can fire before the chunk lands. `LABEL3D_BOUNDS_PROXY` is that stand-in:
 * an invisible `<mesh>`, the same `visible={false}` pattern
 * `nodes/3d/csg/CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY` uses for its own
 * async-loaded content.
 *
 * The proxy is a ZERO-SIZE box at the label's own local origin — a point,
 * not a rect sized from the caption's text/font. This looks like it throws
 * away information the renderer has (`glyphLayout.ts` computes the exact
 * shaped extent), but it does not: Godot's own reference camera never sees
 * that extent either, and matching a richer estimate measurably made this
 * renderer's own framing WORSE, not better. Measured directly, on
 * a probe scene, via a bootstrap that wrote `_scene_bounds()`
 * (`scripts/godot-ref/run.mjs`) at two points — immediately after
 * `add_child()` (mirroring `_place_camera`, which runs synchronously,
 * before any frame settles) and again after `_settle()` (mirroring
 * `--emit-bounds`, which `_write_bounds` calls only after the reference PNG
 * is already saved):
 *
 *   pre-settle:  position [-1.5, -2.0, -1.5]   size [3.0, 4.0, 3.0]
 *   post-settle: position [-2.469, -4.469, -2.469]  size [4.938, 7.445, 4.938]
 *
 * The pre-settle box is exactly the TorusMesh's own extent (outer radius
 * 1.5) unioned with the TWO Label3D nodes' bare Y positions (+2 and -2,
 * `Title`/`Description` in that fixture) — each Label3D contributing only
 * its ORIGIN, no width, no height, no billboard inflation. The post-settle
 * box is the much larger one `label_3d.cpp:625-638`'s billboard-cube
 * inflation predicts once the label has actually shaped its text. Rendering
 * the exact camera the pre-settle box derives (`--camera 1.9226,2.1905,3.5197
 * --look-at 0,0,0`) reproduces Godot's own `--frame` picture pixel-for-pixel;
 * `--emit-bounds`'s later, larger box does not. So `--frame` — the camera
 * every golden is measured against — is placed from a scene-graph state in
 * which Label3D has not yet shaped anything: `_place_camera` runs before
 * `_settle()`, and Label3D's AABB update is not synchronous with
 * `add_child()` despite `NOTIFICATION_ENTER_TREE` requesting it (some part
 * of TextServer shaping evidently lands a frame or more later). `--emit-
 * bounds` is a true, correct read of the FINAL scene bounds; it is simply
 * not the number that produced the reference picture, because it is read
 * later, after the picture was already saved.
 *
 * The practical upshot: no estimate of a Label3D's rendered extent —
 * average-advance, per-character shaped width, or the exact billboard-cube
 * geometry Godot itself eventually settles on — belongs in a framing
 * decision, because Godot's own framing decision never has that number
 * available either. A point is not an approximation of "how big the label
 * is"; it is the precise, measured contribution a Label3D makes to the
 * bounds that actually placed the camera. It also does not need to inherit
 * `useBillboard`'s per-frame rotation to stay correct: a point has no
 * extent to be wrong about under rotation, so the proxy sits directly
 * inside the same group `LabelGlyphs` mounts into, with no separate
 * unrotated sibling required (an earlier version needed one for the cube
 * proxy specifically, which was not rotation-invariant off-axis).
 */

import { Suspense, lazy, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Label3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { useFixedSize } from '../../../r3f/hooks/useFixedSize';

const LabelGlyphs = lazy(() => import('./LabelGlyphs'));

/** Marks the invisible bounds proxy — mirrors `CsgPrimitive.tsx`'s `CSG_BOUNDS_PROXY`, see this file's own doc. */
export const LABEL3D_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

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

  // `label_3d.cpp:396` hands the flag to the same cached shader the billboard
  // mode does; both are per-frame effects on the label's own group.
  useFixedSize(groupRef, properties.fixed_size, scale);

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
        <group scale={properties.pixel_size}>
          <Suspense fallback={null}>
            <LabelGlyphs properties={properties} />
          </Suspense>
        </group>
        {/* Zero-size — a point at the node's own origin, see this file's own
            doc for why that (not a text-sized estimate) is what matches
            Godot's own framing camera. */}
        <mesh visible={false} userData={LABEL3D_BOUNDS_PROXY}>
          <boxGeometry args={[0, 0, 0]} />
        </mesh>
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
