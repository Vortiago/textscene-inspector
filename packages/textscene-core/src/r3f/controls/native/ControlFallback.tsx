/**
 * `<ControlFallback>` — the native (WebGL) counterpart of the DOM
 * `GenericControlFallback`, but with the opposite visibility contract: the
 * DOM fallback is `display: contents` (invisible, for a truly non-Control
 * passthrough node), while a `SolveNode` reaching this component IS a real
 * Control (`buildSolveTree` never emits one for a non-Control type — see its
 * module doc) that simply has no `Native` painter registered yet. Drawing an
 * outline sized to its solved rect is what makes the native path eyeball-able
 * — every registered Control's position/size is visible on the canvas —
 * before any real chrome exists for it.
 *
 * An outline, never a filled quad: a quad would read as actual content, which
 * this deliberately is not.
 *
 * Forwards `children` unchanged (only ever non-empty for a passthrough type
 * like `CanvasLayer` — `ControlCanvasWalker`'s `isCanvasLayer` branch, `
 * NativeControlComponentProps`'s own doc comment): if that type has no real
 * `Native` painter registered yet, its descendants must still reach the
 * scene, just without the fresh context a real one would have provided.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import { useControlClipPlanes } from './controlClipping';

/**
 * Distinguishable from Godot's own chrome without reading as an error — the
 * codebase's "missing resource" magenta (`MissingResourcePlaceholder.tsx`)
 * already means "broken"; this means "not painted yet", a different signal.
 */
const FALLBACK_COLOR = new THREE.Color(0x38bdf8);

export function ControlFallback({ rect, renderOrder, children }: NativeControlComponentProps) {
  const clippingPlanes = useControlClipPlanes();

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(Math.max(rect.w, 0.0001), Math.max(rect.h, 0.0001));
    const edges = new THREE.EdgesGeometry(plane);
    plane.dispose();
    return edges;
  }, [rect.w, rect.h]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <>
      <lineSegments position={[rect.w / 2, -(rect.h / 2), 0]} renderOrder={renderOrder ?? 0} geometry={geometry}>
        <lineBasicMaterial color={FALLBACK_COLOR} clippingPlanes={clippingPlanes as THREE.Plane[]} />
      </lineSegments>
      {children}
    </>
  );
}
