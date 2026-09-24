/**
 * Outlines the solved rect of a real Control that has no `Native` painter, so its
 * position and size still show. An outline, not a fill: a fill reads as content.
 * It forwards `children`, non-empty only for a passthrough type like `CanvasLayer`,
 * so descendants still draw, without the context a real painter would provide.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import { materialProgramInputs } from '../../materialProgramInputs';
import { useControlClipPlanes } from './controlClipping';

/** "Not painted yet": not the "broken" magenta of `MissingResourcePlaceholder.tsx`. */
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

  // No program input here, so the outline never remounts. The key lets a later
  // prop key itself.
  const program = materialProgramInputs({
    props: { color: FALLBACK_COLOR, clippingPlanes: clippingPlanes as THREE.Plane[] },
  });

  return (
    <>
      <lineSegments position={[rect.w / 2, -(rect.h / 2), 0]} renderOrder={renderOrder ?? 0} geometry={geometry}>
        <lineBasicMaterial key={program.key} {...program.props} />
      </lineSegments>
      {children}
    </>
  );
}
