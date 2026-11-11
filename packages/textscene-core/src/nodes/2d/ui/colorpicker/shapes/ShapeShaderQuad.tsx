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
import { useDisposeOnRelease } from '../../../../../r3f/useDisposeOnRelease';
import { useCanvasColorSpace } from '../../../../../r3f/canvasColorSpace';
import { useCanvasModulateFor } from '../../../../../r3f/canvasModulate';
import { godotColorToLinear } from '../../../../../r3f/godotColor';
import { shapeFillInjection, type ShapeFillUniforms } from './shapeFillProgram';
import type { ShapeShaderFill } from './shapeDrawing';
import type { ShapeFragment } from './shapeFragment';

const WHITE = new THREE.Color(1, 1, 1);

/** The fill's quad, from (0, 0) to (w, -h), so the vertex stage reads `UV` off the position. */
function fillQuad(w: number, h: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, w, 0, 0, w, -h, 0, 0, -h, 0]), 3)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function fillUniforms(fragment: ShapeFragment): ShapeFillUniforms {
  return {
    shape: Object.fromEntries(fragment.uniforms.map((name) => [name, { value: 0 }])),
    size: { value: new THREE.Vector2() },
    canvasModulate: { value: new THREE.Color() },
  };
}

export function ShapeShaderQuad({ fill, renderOrder }: { fill: ShapeShaderFill; renderOrder: number }) {
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const canvasItemMerge = useCanvasItemMerge();
  const { isLinear } = useCanvasColorSpace();
  // The shape's material is a ShaderMaterial in the default light mode, whatever the picker's own.
  const canvasModulate = useCanvasModulateFor(null);
  const { w, h } = fill.rect;

  const uniforms = useMemo(() => fillUniforms(fill.fragment), [fill.fragment]);
  useLayoutEffect(() => {
    uniforms.size.value.set(w, h);
    for (const name of fill.fragment.uniforms) uniforms.shape[name]!.value = fill.uniforms[name]!;
    uniforms.canvasModulate.value = isLinear
      ? godotColorToLinear(canvasModulate)
      : new THREE.Color(canvasModulate.r, canvasModulate.g, canvasModulate.b);
  }, [uniforms, w, h, fill, isLinear, canvasModulate]);

  const injection = useMemo(
    () => shapeFillInjection(fill.fragment, uniforms, isLinear),
    [fill.fragment, uniforms, isLinear]
  );
  const geometry = useMemo(() => fillQuad(w, h), [w, h]);
  useDisposeOnRelease(geometry);

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
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
