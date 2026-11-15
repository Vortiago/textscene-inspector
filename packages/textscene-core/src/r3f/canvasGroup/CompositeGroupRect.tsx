/**
 * The rect of a composite CanvasGroup: its buffer, the composite material over it, the two rect
 * meshes and their fit, registered with the canvas group pass (`renderer_canvas_cull.cpp:196-256`).
 */

import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CanvasItemPixelMaterial } from '../components/LitCanvasItemPixels';
import type { CanvasItemTint } from '../canvasItemModulate';
import { canvasNumbersOf, useCanvasColorSpace, type CanvasColorSpace } from '../canvasColorSpace';
import { CanvasSurfaceMaterial } from '../canvasMesh/CanvasSurfaceMaterial';
import type { CanvasClip } from '../lighting2d/lightPassHost';
import type { Rgba } from '../../godot/math/math';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { registerCanvasGroup } from './canvasGroupPass';
import { canvasGroupRectTag } from './keyedScene';
import type { CanvasGroupWindow } from './groupWindow';
import { useGroupFit } from './useGroupFit';
import { useCompositeBuffer } from './compositeBuffer';

/** A unit square at the origin, which each rect mesh scales to the fitted rect. */
const UNIT_SQUARE = new THREE.PlaneGeometry(1, 1);

export interface CompositeGroupRectProps {
  window: CanvasGroupWindow;
  tint: CanvasItemTint;
  /** The CanvasItemMaterial in force, which replaces the group shader with a plain rect. */
  material: CanvasItemMaterialProperties | null;
  pixelMaterial: CanvasItemPixelMaterial;
  fitMargin: number;
  clearMargin: number;
}

/**
 * The group's rect, in two meshes of which the pass shows one each frame: the composite over the
 * buffer, or a plain rect of the group colour. A material in force draws the plain rect
 * (`renderer_canvas_render_rd.cpp:2207-2219`), and so does a group inside another group's window,
 * which Godot's renderer draws as an ordinary item (`:812-813`).
 */
export function CompositeGroupRect({
  window,
  tint,
  material,
  pixelMaterial,
  fitMargin,
  clearMargin,
}: CompositeGroupRectProps) {
  const scene = useThree((state) => state.scene);
  const space = useCanvasColorSpace();
  const { buffer, compositeMaterial } = useCompositeBuffer(space);
  useLayoutEffect(() => {
    writeCompositeColour(compositeMaterial.uniforms.colour!.value as THREE.Vector4, tint.self, space);
  }, [compositeMaterial, tint.self, space]);

  const fitRect = useGroupFit({ fitMargin, clearMargin });
  const composite = useRef<THREE.Mesh>(null);
  const plain = useRef<THREE.Mesh>(null);
  const readsBuffer = material === null;
  useLayoutEffect(() => {
    /** Hides both rect meshes, then shows the plain one or the composite over the fitted rect. */
    const fitAndPlace = (drawn: readonly THREE.Box3[], frameClip: CanvasClip | null, isPlain: boolean) => {
      if (composite.current) composite.current.visible = false;
      if (plain.current) plain.current.visible = false;
      const rects = fitRect(drawn, frameClip);
      if (!rects) return null;
      const shown = isPlain ? plain.current : composite.current;
      if (shown) placeRect(shown, rects.fitted);
      return rects.cleared;
    };
    return registerCanvasGroup(scene, {
      kind: 'composite',
      window,
      buffer: readsBuffer ? buffer : null,
      fit: (drawn, frameClip) => fitAndPlace(drawn, frameClip, !readsBuffer),
      fitNested: (drawn, frameClip) => fitAndPlace(drawn, frameClip, true),
    });
  }, [scene, window, buffer, readsBuffer, fitRect]);

  // Hidden until the pass fits them: a canvas drawn without the pass shows no unit square.
  return (
    <>
      <mesh
        ref={composite}
        visible={false}
        geometry={UNIT_SQUARE}
        material={compositeMaterial}
        userData={canvasGroupRectTag()}
      />
      <mesh ref={plain} visible={false} geometry={UNIT_SQUARE} userData={canvasGroupRectTag()}>
        <CanvasSurfaceMaterial
          map={null}
          color={tint.color}
          opacity={tint.opacity}
          vertexColors={null}
          drawsPoints={false}
          pixelMaterial={pixelMaterial}
        />
      </mesh>
    </>
  );
}

const toLocal = new THREE.Matrix4();
const localBox = new THREE.Box3();

/**
 * Shows `mesh` over the bounds, in its parent's space, of `world`: Godot draws the rect at
 * `p_transform.affine_inverse().xform(rect_accum)` (`renderer_canvas_cull.cpp:233`).
 */
function placeRect(mesh: THREE.Mesh, world: THREE.Box3): void {
  toLocal.copy(mesh.parent!.matrixWorld).invert();
  localBox.copy(world).applyMatrix4(toLocal);
  localBox.getCenter(mesh.position);
  mesh.position.z = 0;
  mesh.scale.set(localBox.max.x - localBox.min.x, localBox.max.y - localBox.min.y, 1);
  mesh.visible = true;
  // The pass draws the buffers after the scene's last matrix update.
  mesh.updateMatrixWorld();
}

/**
 * The group colour in the numbers the composite writes: sRGB in an sRGB canvas, linear in a
 * linear one, where Godot converts each modulate before it multiplies.
 */
function writeCompositeColour(out: THREE.Vector4, colour: Rgba, space: CanvasColorSpace): void {
  const { r, g, b } = canvasNumbersOf(space, colour);
  out.set(r, g, b, colour.a);
}
