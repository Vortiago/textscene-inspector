/**
 * `<ControlQuad>` — the shared quad geometry every native Control painter
 * draws its chrome with (a flat StyleBox fill, a TextureRect image, …). The
 * Control-space twin of Sprite2D's `QuadMesh`
 * (`nodes/2d/sprite2d/Component.tsx`): unlike a CanvasItem2D quad (whose
 * `centered`/`offset` properties can put its centre anywhere), a Control's
 * rect is always measured from its own top-left, so this quad is unconditionally
 * centred at `[w/2, -h/2, 0]` — Y negated once, same convention `rect.ts`
 * documents for the walker's own outer-group placement.
 *
 * Unlit (`meshBasicMaterial`, matching Godot's 2D canvas), transparent,
 * double-sided and non-depth-writing so overlapping/alpha-edged Control
 * chrome composites the same way a CanvasItem2D quad does. Spreads
 * `useControlClipPlanes()` — clip planes are per-MATERIAL state, so every
 * leaf material must carry them even while the list stays empty (see
 * `controlClipping.tsx`).
 */
import * as THREE from 'three';
import { useControlClipPlanes } from './controlClipping';

export interface ControlQuadProps {
  width: number;
  height: number;
  color: THREE.Color;
  opacity: number;
  map?: THREE.Texture | null;
}

export function ControlQuad({ width, height, color, opacity, map = null }: ControlQuadProps) {
  const clippingPlanes = useControlClipPlanes();
  return (
    <mesh position={[width / 2, -(height / 2), 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={map}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes as THREE.Plane[]}
      />
    </mesh>
  );
}
