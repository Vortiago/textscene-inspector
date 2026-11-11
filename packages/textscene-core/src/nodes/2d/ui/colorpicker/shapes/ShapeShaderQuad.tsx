/**
 * `<ShapeShaderQuad>`: one shape's shader fill, a quad at local (0, 0) whose colour the shape's
 * `fragment()` gives per fragment (`shapeFillProgram.ts`). It joins the lit item around it, as a
 * Godot `canvas_item` shader's `COLOR` is lit like any canvas item.
 */
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useCanvasItemMerge } from '../../../../../r3f/components/LitCanvasItemPixels';
import { useControlClipPlanes } from '../../../../../r3f/controls/native/controlClipping';
import { materialProgramInputs } from '../../../../../r3f/materialProgramInputs';
import { canvasNumbersOf, useCanvasColorSpace } from '../../../../../r3f/canvasColorSpace';
import { useCanvasModulateFor } from '../../../../../r3f/canvasModulate';
import { shapeFillInjection, type ShapeFillUniforms } from './shapeFillProgram';
import type { ShapeShaderFill } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';

const WHITE = new THREE.Color(1, 1, 1);

/**
 * The unit quad from (0, 0) to (1, -1) that every fill shares, scaled to the fill's rect, so a resize
 * builds no geometry. It lives for the module, so no fill disposes it.
 */
const UNIT_QUAD = new THREE.BufferGeometry()
  .setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, -1, 0, 0, -1, 0]), 3)
  )
  .setIndex([0, 1, 2, 0, 2, 3]);

function fillUniforms(fragment: ShapeFragment): ShapeFillUniforms {
  return {
    shape: Object.fromEntries(fragment.uniforms.map((name) => [name, { value: 0 }])),
    canvasModulate: { value: new THREE.Color() },
  };
}

export function ShapeShaderQuad({ fill, renderOrder }: { fill: ShapeShaderFill; renderOrder: number }) {
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const canvasItemMerge = useCanvasItemMerge();
  const space = useCanvasColorSpace();
  const { isLinear } = space;
  // The shape's material is a ShaderMaterial in the default light mode, whatever the picker's own.
  const canvasModulate = useCanvasModulateFor(null);
  const { w, h } = fill.rect;

  const uniforms = useMemo(() => fillUniforms(fill.fragment), [fill.fragment]);
  useLayoutEffect(() => {
    for (const name of fill.fragment.uniforms) uniforms.shape[name]!.value = fill.uniforms[name]!;
  }, [uniforms, fill]);
  useLayoutEffect(() => {
    const { r, g, b } = canvasNumbersOf(space, canvasModulate);
    uniforms.canvasModulate.value.setRGB(r, g, b);
  }, [uniforms, space, canvasModulate]);

  const injection = useMemo(
    () => shapeFillInjection(fill.fragment, uniforms, isLinear),
    [fill.fragment, uniforms, isLinear]
  );

  const program = materialProgramInputs({
    props: {
      color: WHITE,
      opacity: canvasModulate.a,
      transparent: true,
      depthWrite: false,
      clippingPlanes,
      injection,
    },
    merge: canvasItemMerge,
  });
  return (
    <mesh renderOrder={renderOrder} scale={[w, h, 1]}>
      <primitive object={UNIT_QUAD} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
