/**
 * The quad every native Control painter draws its chrome with. A Control's rect is
 * measured from its top-left, so the quad centres at `[w/2, -h/2, 0]` (Y negated
 * once, as in `rect.ts`). Transparent and depth-free like a CanvasItem2D quad, it samples the
 * light list of the lit item around it (`useCanvasItemMerge`), and every leaf material
 * carries the clip planes (`controlClipping.tsx`).
 */
import * as THREE from 'three';
import type { SurfaceDrawHooks } from '../../surfaceDrawHooks';
import { useControlClipPlanes } from './controlClipping';
import { canvasMapProps } from '../../canvas2DTextureDecode';
import { useCanvasItemMerge } from '../../components/LitCanvasItemPixels';
import { materialProgramInputs } from '../../materialProgramInputs';
import type { MaterialAttach } from '../../materials/swappedMaterials';
import { FadedMaterials } from '../../materials/FadedMaterials';
import { useCanvasColorSpace } from '../../canvasColorSpace';

/** The thickness of a `draw_line` without a width, in Godot px: one hairline pixel. */
export const HAIRLINE_THICKNESS_PX = 1;

/**
 * `draw_line` without a width is a two-point line, not a quad (`renderer_canvas_cull.cpp:754-763`).
 * Vulkan lights the pixel within half a pixel of it, and on a tie the one before it. A quad whose
 * top edge sits this far above the line covers that pixel under the top-left tie rule (ADR-0057).
 */
export const HAIRLINE_CENTRE_OFFSET_PX = HAIRLINE_THICKNESS_PX / 2;

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
  /** Writes its texels over what is behind it, alpha included, where a blend would multiply that alpha twice. */
  replacesBackdrop?: boolean;
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
  replacesBackdrop = false,
  drawHooks,
}: ControlQuadProps) {
  const clippingPlanes = useControlClipPlanes();
  const canvasItemMerge = useCanvasItemMerge();
  const canvasSpace = useCanvasColorSpace();
  // A `map` is often null on the first render and a texture later, while the quad
  // draws throughout, so the material is replaced, not mutated
  // (`materialProgramInputs.ts`).
  const material = (attach: string | MaterialAttach | undefined) => {
    const program = materialProgramInputs({
      props: {
        attach,
        // In an sRGB canvas, a `NoColorSpace`-retagged canvas texture and a canvas-content
        // SubViewport target get the sRGB multiply. A 3D-content target does not.
        ...canvasMapProps(map, canvasSpace),
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        ...(replacesBackdrop && { blending: THREE.NoBlending }),
        clippingPlanes: clippingPlanes as THREE.Plane[],
      },
      // The double-sided, single-pass facing and the lit pixel material of the item around it.
      merge: canvasItemMerge,
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
