/**
 * The quad every native Control painter draws its chrome with. A Control's rect is
 * measured from its top-left, so the quad centres at `[w/2, -h/2, 0]` (Y negated
 * once, as in `rect.ts`). Transparent and depth-free like a CanvasItem2D quad, it samples the
 * light list of the lit item around it (`useCanvasItemPixelMaterial`), and every leaf material
 * carries the clip planes (`controlClipping.tsx`).
 */
import * as THREE from 'three';
import type { SurfaceDrawHooks } from '../../surfaceDrawHooks';
import { useControlClipPlanes } from './controlClipping';
import { canvasMapProps } from '../../canvas2DTextureDecode';
import { useCanvasItemPixelMaterial } from '../../components/LitCanvasItemPixels';
import { canvasItemFacing } from '../../canvasItemFacing';
import { materialProgramInputs } from '../../materialProgramInputs';
import type { MaterialAttach } from '../../materials/swappedMaterials';
import { FadedMaterials } from '../../materials/FadedMaterials';

interface ControlQuadProps {
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
  /** The draw hooks of the GeometryInstance3D a Label3D's hex-code box draws for. It casts nothing. */
  drawHooks?: SurfaceDrawHooks;
}

export function ControlQuad({
  width,
  height,
  color,
  opacity,
  map = null,
  renderOrder,
  drawHooks,
}: ControlQuadProps) {
  const clippingPlanes = useControlClipPlanes();
  const pixelMaterial = useCanvasItemPixelMaterial();
  // A `map` is often null on the first render and a texture later, while the quad
  // draws throughout, so the material is replaced, not mutated
  // (`materialProgramInputs.ts`).
  const material = (attach: string | MaterialAttach | undefined) => {
    const program = materialProgramInputs({
      props: {
        attach,
        // A `NoColorSpace`-retagged canvas texture and a canvas-content SubViewport
        // target get the sRGB multiply. A 3D-content target does not.
        ...canvasMapProps(map),
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        clippingPlanes: clippingPlanes as THREE.Plane[],
      },
      // The double-sided, single-pass pair every flat canvas painter shares.
      merge: [canvasItemFacing(), pixelMaterial],
    });
    return <meshBasicMaterial key={program.key} {...program.props} />;
  };

  return (
    <mesh
      position={[width / 2, -(height / 2), 0]}
      renderOrder={renderOrder}
      onBeforeRender={drawHooks?.onBeforeRender}
      onAfterRender={drawHooks?.onAfterRender}
      onBeforeShadow={drawHooks?.onBeforeShadow}
      onAfterShadow={drawHooks?.onAfterShadow}
    >
      <planeGeometry args={[width, height]} />
      {/* Inside a GeometryInstance3D drawer, a Label3D's hex-code box, the quad fades with the label. */}
      <FadedMaterials>{(_pass, attach) => material(attach)}</FadedMaterials>
    </mesh>
  );
}
