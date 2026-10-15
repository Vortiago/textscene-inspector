/**
 * <FogVolume>: puts a fog volume into the scene at the node's transform, which the volumetric fog
 * finds and draws (`r3f/fog/fogVolumeRows.ts`). It draws nothing of its own, so it draws nothing
 * where the Environment's volumetric fog is off, as in Godot.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { fogVolumeSize } from '../../../godot/rendering/environment/fogVolume';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import {
  DEFAULT_FOG_VOLUME_FILL,
  FogVolumeObject,
  type FogVolumeFill,
} from '../../../r3f/fog/fogVolumeObject';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { NO_RESOURCES, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { decodeFogMaterial } from '../../../resources/materials/fogmaterial/decode';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { useTexture3D } from '../../../resources/useTexture3D';
import { Node3D } from '../../base/node3d/Component';
import type { FogVolumeProperties } from './types';
import type { Vector3 } from '../../../godot/math/vector';

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const FogVolumeElement = extend(FogVolumeObject);

/**
 * What fills a volume with this material. A ShaderMaterial runs its own fog shader. Anything else,
 * or none, runs Godot's default one (`environment/fog.cpp:640-643`).
 */
function fillOf(material: { type: string; data: Record<string, string> } | null): FogVolumeFill {
  if (material?.type === 'FogMaterial') {
    return { kind: 'material', material: decodeFogMaterial(material.data), densityTexture: null };
  }
  if (material?.type === 'ShaderMaterial') return { kind: 'shader' };
  return DEFAULT_FOG_VOLUME_FILL;
}

/** `fill` with the FogMaterial's density texture, once built or loaded. */
function withDensityTexture(fill: FogVolumeFill, texture: THREE.Data3DTexture | null): FogVolumeFill {
  if (fill.kind !== 'material' || !texture) return fill;
  return { ...fill, densityTexture: texture };
}

export function FogVolume({ node, children }: NodeComponentProps) {
  const properties = node.properties as FogVolumeProperties;
  const { scoped } = useResourceResolution(properties.material, useSceneResources());
  const materialFill = useMemo(() => fillOf(scoped?.resource ?? null), [scoped]);
  const densityTextureRef = materialFill.kind === 'material' ? materialFill.material.densityTexture : null;
  const densityTexture = useTexture3D(densityTextureRef ?? undefined, scoped?.resources ?? NO_RESOURCES);
  const fill = useMemo(
    () => withDensityTexture(materialFill, densityTexture),
    [materialFill, densityTexture]
  );
  const animatedSize = useAnimatedValue<Vector3>('size', (v) => ({
    x: v[0] ?? 0,
    y: v[1] ?? 0,
    z: v[2] ?? 0,
  }));
  // An animated size clamps as an authored one does.
  const size = animatedSize ? fogVolumeSize(animatedSize) : properties.size;

  return (
    <Node3D node={node}>
      <FogVolumeElement size={[size.x, size.y, size.z]} shape={properties.shape} fill={fill} />
      {children}
    </Node3D>
  );
}
