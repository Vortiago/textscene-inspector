/**
 * `<TexturedFillMesh>`: a hand-built, textured `BufferGeometry` with `ControlQuad`'s material, for
 * the nine-patch and radial-fan shapes a `<planeGeometry>` cannot draw. Positions are Godot px,
 * +Y down, size-relative and flipped as in `StyleBoxQuad`, so a caller offsets through a wrapping
 * `<CanvasItemGroup>`, never in the geometry.
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
  /** Already linear, as `ControlQuad`'s `color` prop expects. */
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

  // R3F does not auto-dispose a geometry passed through `attach`.
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
