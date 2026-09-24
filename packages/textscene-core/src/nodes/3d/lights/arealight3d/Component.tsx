/**
 * <AreaLight3D>: a three.js RectAreaLight sized from `area_size` (default 1×1).
 * RectAreaLight has no shadows and no range, so shadow_* and `area_range` are
 * not applied. It emits nothing until the LTC uniforms exist, so module load
 * calls the idempotent `RectAreaLightUniformsLib.init()` once.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { AreaLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';

RectAreaLightUniformsLib.init();

const DEFAULT_AREA_SIZE = { x: 1, y: 1 } as const;

export function AreaLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as AreaLight3DProperties;
  const lightRef = useRef<THREE.RectAreaLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const { x: width, y: height } = properties.area_size ?? DEFAULT_AREA_SIZE;
  // Godot divides the emitted colour by the rectangle's surface area when
  // `area_normalize_energy` is on (its default), so the total output is
  // size-independent. three.js RectAreaLight intensity is a luminance, which
  // scales with area for the same reason, so the same division applies here.
  const area = width * height;
  const normalize = properties.area_normalize_energy && area > 0;
  const intensity =
    (properties.light_energy * LIGHT_INTENSITY_SCALE) / (normalize ? area : 1);

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <rectAreaLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        width={width}
        height={height}
      />
      {children}
    </group>
  );
}
