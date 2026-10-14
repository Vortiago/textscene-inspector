/**
 * <FogVolume>: puts a fog volume into the scene at the node's transform, which the volumetric fog
 * finds and draws (`r3f/fog/fogVolumeRows.ts`). It draws nothing of its own, so it draws nothing
 * where the Environment's volumetric fog is off, as in Godot.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { fogVolumeSize } from '../../../godot/fogVolume';
import type { TscnInternalResource } from '../../../parser/types';
import type { Vector3 } from '../../../parser/vectors';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import {
  DEFAULT_FOG_VOLUME_FILL,
  FogVolumeObject,
  type FogVolumeFill,
} from '../../../r3f/fog/fogVolumeObject';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { decodeFogMaterial } from '../../../resources/materials/fogmaterial/decode';
import { useProceduralTexture3D } from '../../../resources/useProceduralTexture';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { Node3D } from '../../base/node3d/Component';
import type { FogVolumeProperties } from './types';

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const FogVolumeElement = extend(FogVolumeObject);
const NO_RESOURCES: readonly TscnInternalResource[] = [];

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

/** `fill` with the FogMaterial's density texture, once built. */
function withDensityTexture(fill: FogVolumeFill, texture: THREE.Texture | null): FogVolumeFill {
  if (fill.kind !== 'material' || !(texture instanceof THREE.Data3DTexture)) return fill;
  return { ...fill, densityTexture: texture };
}

export function FogVolume({ node, children }: NodeComponentProps) {
  const properties = node.properties as FogVolumeProperties;
  const { scoped } = useResourceResolution(properties.material, useSceneResources());
  const materialFill = useMemo(() => fillOf(scoped?.resource ?? null), [scoped]);
  const densityTextureRef = materialFill.kind === 'material' ? materialFill.material.densityTexture : null;
  const densitySlot = useProceduralTexture3D(
    densityTextureRef ?? undefined,
    scoped?.resources.internalResources ?? NO_RESOURCES
  );
  const fill = useMemo(
    () => withDensityTexture(materialFill, densitySlot.texture),
    [materialFill, densitySlot.texture]
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
