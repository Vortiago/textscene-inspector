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
 *
 * `map`'s decode is auto-detected (`useCanvasDecodeDefines`,
 * `canvas2DTextureDecode.ts`): a `NoColorSpace`-retagged 2D-canvas texture
 * (TextureRect's image, Button's icon) gets the post-filter decode; a
 * vendored theme icon or a SubViewport render target — neither retagged —
 * does not, so this one recipe serves every kind of `map` ControlQuad's
 * many callers pass without each caller having to know which kind it has.
 */
import * as THREE from 'three';
import { useControlClipPlanes } from './controlClipping';
import { useCanvasDecodeDefines } from '../../canvas2DTextureDecode';

export interface ControlQuadProps {
  width: number;
  height: number;
  color: THREE.Color;
  opacity: number;
  map?: THREE.Texture | null;
  /**
   * Paint order within the 2D transparent bucket. Load-bearing rather than
   * cosmetic: nothing here writes depth, so three's transparent sort — which
   * reads `renderOrder` before camera distance — is the *only* thing deciding
   * which Control covers which. A quad that drops it paints in traversal order
   * and silently ignores both `z_index` and `CanvasLayer.layer`.
   */
  renderOrder: number;
}

export function ControlQuad({
  width,
  height,
  color,
  opacity,
  map = null,
  renderOrder,
}: ControlQuadProps) {
  const clippingPlanes = useControlClipPlanes();
  const decodeDefines = useCanvasDecodeDefines(map);
  return (
    <mesh position={[width / 2, -(height / 2), 0]} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={map}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        defines={decodeDefines}
        clippingPlanes={clippingPlanes as THREE.Plane[]}
      />
    </mesh>
  );
}
