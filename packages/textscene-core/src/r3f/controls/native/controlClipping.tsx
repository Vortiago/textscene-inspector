/**
 * The accumulated canvas clip for the native Control canvas, as clip planes: the 2D `<Canvas>` in
 * `World2DCanvas.tsx` has no stencil buffer. The clip is a rounded rect first and planes second, as
 * Godot's scissor is (`servers/rendering/renderer_canvas_cull.cpp:412-424`). Planes are
 * per-material, so every leaf material spreads `useControlClipPlanes`. See `controlClipping.md`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { rect2Intersection } from '../../../godot/math/rect2';
import type * as THREE from 'three';
import {
  localRectClipPlanes,
  quantizeClipRect,
  withAdditionalClipPlanes,
  worldClipRect,
} from './controlClipGeometry';
import type { Rect2 } from '../../../godot/math/rect2';

/**
 * What a clipping Control publishes to its subtree. `rect` is the rounded clip in
 * absolute Godot canvas pixels (+Y down): Godot rounds there, and the 2D world
 * maps onto it with y negated. It is null for a rotated chain, where `planes` alone clips.
 */
interface ControlClip {
  readonly planes: readonly THREE.Plane[];
  readonly rect: Rect2 | null;
}

/** No enclosing clipper: nothing is cut and there is no rect to intersect against. */
const NO_CONTROL_CLIP: ControlClip = { planes: [], rect: null };

const ControlClipContext = createContext<ControlClip>(NO_CONTROL_CLIP);
ControlClipContext.displayName = 'ControlClipContext';

export const ControlClipProvider = ControlClipContext.Provider;

/** The whole accumulated clip: planes, and the rect a nested clipper intersects against. */
function useControlClip(): ControlClip {
  return useContext(ControlClipContext);
}

/** The clip planes of every enclosing Control, empty outside any provider. */
export function useControlClipPlanes(): readonly THREE.Plane[] {
  return useControlClip().planes;
}

/** 4 planes × (normal.x, normal.y, normal.z, constant), plus a has-rect flag. */
const CLIP_FLOATS = 17;

function clipSignature(clip: ControlClip, out: Float64Array): void {
  out.fill(0);
  clip.planes.forEach((p, i) => {
    out[i * 4] = p.normal.x;
    out[i * 4 + 1] = p.normal.y;
    out[i * 4 + 2] = p.normal.z;
    out[i * 4 + 3] = p.constant;
  });
  out[CLIP_FLOATS - 1] = clip.rect === null ? 0 : 1;
}

function sameFloats(a: Float64Array, b: Float64Array): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * `localRect` on the canvas, quantized like Godot's scissor and merged onto the
 * inherited clip. Attach `anchorRef` to the group whose frame `localRect` is in,
 * put `clippingPlanes` on each clipped material, and publish `clip` through a
 * `ControlClipProvider` to clip a subtree.
 */
export function useWorldClipPlanes(localRect: Rect2): {
  anchorRef: RefObject<THREE.Group | null>;
  clippingPlanes: readonly THREE.Plane[];
  clip: ControlClip;
} {
  const inherited = useControlClip();
  const anchorRef = useRef<THREE.Group>(null);
  const [own, setOwn] = useState<ControlClip>(NO_CONTROL_CLIP);
  const previousFloats = useRef<Float64Array | null>(null);

  // No dependency array: an ancestor's world transform is no React value, so this
  // re-samples after every render. The float comparison below stops the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.updateWorldMatrix(true, false);
    // Planes inherited without a rect come from a rotated ancestor. A quantized
    // rect here would claim to be the whole clip and drop them below.
    const quantizable = inherited.rect !== null || inherited.planes.length === 0;
    const world = quantizable ? worldClipRect(localRect, anchor.matrixWorld) : null;
    let next: ControlClip;
    if (world === null) {
      const planes = localRectClipPlanes(localRect).map((p) => p.clone().applyMatrix4(anchor.matrixWorld));
      next = { planes, rect: null };
    } else {
      const rect = quantizeClipRect(inherited.rect ? rect2Intersection(inherited.rect, world) : world);
      next = { planes: localRectClipPlanes(rect), rect };
    }
    const floats = new Float64Array(CLIP_FLOATS);
    clipSignature(next, floats);
    if (previousFloats.current && sameFloats(previousFloats.current, floats)) return;
    previousFloats.current = floats;
    setOwn(next);
  });

  // Memoised: a context value, and `withAdditionalClipPlanes` returns a fresh
  // array once this node adds planes. A fresh identity re-renders every consumer,
  // and `TextRun` keys its `ShaderMaterial` off this array.
  const clippingPlanes = useMemo(
    () =>
      inherited.rect !== null && own.rect !== null
        ? // The intersection already carries the ancestor's boundary, and
          // Godot's scissor is this node's own rect alone.
          own.planes
        : withAdditionalClipPlanes(inherited.planes, own.planes),
    [inherited, own]
  );

  const clip = useMemo<ControlClip>(
    () => ({ planes: clippingPlanes, rect: own.rect }),
    [clippingPlanes, own.rect]
  );

  return { anchorRef, clippingPlanes, clip };
}
