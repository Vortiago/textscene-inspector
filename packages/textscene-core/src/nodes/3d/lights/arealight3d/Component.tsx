/**
 * <AreaLight3D> — Godot rectangular area light. Renders as a three.js
 * RectAreaLight, with width/height read from the parsed `area_size`
 * Vector2 (defaults to 1×1). RectAreaLight has no shadow support, so
 * shadow_* properties are silently ignored by the component; `area_range`
 * is likewise carried on the parsed node but not applied (three.js
 * RectAreaLight has no range/penumbra control).
 *
 * three.js RectAreaLight emits ZERO illumination until the LTC uniform
 * library is populated, so we call `RectAreaLightUniformsLib.init()` once
 * at module load (idempotent; no renderer arg — it only fills the global
 * `UniformsLib` LTC textures). This is the first RectAreaLight in the
 * codebase, so there is no shared bootstrap to reuse; siblings
 * (Spot/Omni/Directional) are plain three.js lights that need no such init.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { AreaLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE } from '../../../../utils/lightConstants';

RectAreaLightUniformsLib.init();

const DEFAULT_AREA_SIZE = { x: 1, y: 1 } as const;

export function AreaLight3D({ node }: NodeComponentProps) {
  const properties = node.properties as AreaLight3DProperties;
  const lightRef = useRef<THREE.RectAreaLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const { x: width, y: height } = properties.area_size ?? DEFAULT_AREA_SIZE;

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
