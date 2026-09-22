/**
 * `<TexturedFillMesh>` — a hand-built, textured `BufferGeometry` drawn with
 * `ControlQuad`'s own material recipe (`meshBasicMaterial`, `map`/`color`/
 * `opacity`, `useCanvasDecodeDefines`'s auto-detected decode,
 * `canvasItemFacing()`). `ControlQuad` itself only ever builds a plain
 * rectangle (`<planeGeometry>`); the nine-patch and radial-fan geometry this
 * slice needs (`ninePatchGeometry`, `radialFillGeometry`) are neither, so
 * this is `StyleBoxQuad`'s "hand-built geometry via `<primitive>`" shape
 * (`Polygon2D`'s `FilledPolygon` is the ORIGINAL precedent for that) with a
 * texture instead of vertex colours.
 *
 * Positions are Godot pixels, +Y down, SIZE-relative (0-based) — the SAME
 * convention `StyleBoxQuad` takes, flipped the SAME way (`<group scale={[1,
 * -1, 1]}>`): a caller offsets via a wrapping `<CanvasItemGroup>`, never by
 * baking a position into the geometry itself.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useCanvasDecodeDefines } from '../../../../r3f/canvas2DTextureDecode';
import { canvasItemFacing } from '../../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../../r3f/materialProgramInputs';

export interface TexturedFillMeshGeometry {
  positions: number[];
  uvs: number[];
  indices: number[];
}

export interface TexturedFillMeshProps {
  geometry: TexturedFillMeshGeometry | null;
  texture: THREE.Texture;
  /** Already-LINEAR, matching `ControlQuad`'s own `color` prop contract. */
  color: THREE.Color;
  opacity: number;
  renderOrder: number;
}

export function TexturedFillMesh({ geometry, texture, color, opacity, renderOrder }: TexturedFillMeshProps) {
  const clippingPlanes = useControlClipPlanes();
  const decodeDefines = useCanvasDecodeDefines(texture);

  const builtGeometry = useMemo(() => {
    if (!geometry || geometry.positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geometry.positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.uvs), 2));
    geo.setIndex(geometry.indices);
    return geo;
  }, [geometry]);

  // R3F does not auto-dispose a geometry passed via `attach` (`StyleBoxQuad`'s own doc).
  useEffect(() => () => builtGeometry?.dispose(), [builtGeometry]);

  if (!builtGeometry) return null;

  const program = materialProgramInputs({
    props: {
      map: texture,
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
      clippingPlanes: clippingPlanes as THREE.Plane[],
    },
    merge: [canvasItemFacing()],
  });

  return (
    <group scale={[1, -1, 1]} renderOrder={renderOrder}>
      <mesh renderOrder={renderOrder}>
        <primitive object={builtGeometry} attach="geometry" />
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </group>
  );
}
