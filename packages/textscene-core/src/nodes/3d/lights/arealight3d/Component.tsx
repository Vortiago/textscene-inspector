/**
 * <AreaLight3D> — Godot rectangular area light. Renders as a three.js
 * RectAreaLight with width/height derived from the `area_size` Vector2
 * string.  RectAreaLight has no shadow support; shadow_* properties are
 * silently ignored by the component.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { AreaLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE } from '../../../../utils/lightConstants';

function parseAreaSize(raw: string | undefined | null): [number, number] {
  if (!raw) return [1, 1];
  const m = raw.match(/Vector2\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
  if (!m || !m[1] || !m[2]) return [1, 1];
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return [isFinite(w) ? w : 1, isFinite(h) ? h : 1];
}

export function AreaLight3D({ node }: NodeComponentProps) {
  const properties = node.properties as AreaLight3DProperties;
  const lightRef = useRef<THREE.RectAreaLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const [width, height] = parseAreaSize(properties.area_size);

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <rectAreaLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        width={width}
        height={height}
      />
    </group>
  );
}
