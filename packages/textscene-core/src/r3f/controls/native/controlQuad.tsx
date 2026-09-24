/**
 * The quad every native Control painter draws its chrome with. A Control's rect is
 * measured from its top-left, so the quad centres at `[w/2, -h/2, 0]` (Y negated
 * once, as in `rect.ts`). Unlit, transparent and depth-free like a CanvasItem2D
 * quad, and every leaf material carries the clip planes (`controlClipping.tsx`).
 */
import * as THREE from 'three';
import { useControlClipPlanes } from './controlClipping';
import { useCanvasDecodeDefines } from '../../canvas2DTextureDecode';
import { canvasItemFacing } from '../../canvasItemFacing';
import { materialProgramInputs } from '../../materialProgramInputs';

export interface ControlQuadProps {
  width: number;
  height: number;
  color: THREE.Color;
  opacity: number;
  map?: THREE.Texture | null;
  /**
   * Paint order in the 2D transparent bucket. Nothing writes depth, so three's sort,
   * which reads `renderOrder` before distance, alone decides which Control covers
   * which. Without it, `z_index` and `CanvasLayer.layer` are ignored.
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
  // A `NoColorSpace`-retagged canvas texture gets the post-filter decode, and a
  // SubViewport target, which keeps its own colour space, does not.
  const decodeDefines = useCanvasDecodeDefines(map);

  // A `map` is often null on the first render and a texture later, while the quad
  // draws throughout, so the material is replaced, not mutated
  // (`materialProgramInputs.ts`).
  const program = materialProgramInputs({
    props: {
      map,
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
      clippingPlanes: clippingPlanes as THREE.Plane[],
    },
    // The double-sided, single-pass pair every flat canvas painter shares.
    merge: [canvasItemFacing()],
  });

  return (
    <mesh position={[width / 2, -(height / 2), 0]} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
