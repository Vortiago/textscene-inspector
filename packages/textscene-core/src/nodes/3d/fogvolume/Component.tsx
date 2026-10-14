/**
 * <FogVolume>: puts a fog volume into the scene at the node's transform, which the volumetric fog
 * finds and draws (`r3f/fog/fogVolumeRows.ts`). It draws nothing of its own, so it draws nothing
 * where the Environment's volumetric fog is off, as in Godot.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { TscnInternalResource } from '../../../parser/types';
import type { Vector3 } from '../../../parser/vectors';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { FogVolumeObject, type FogVolumeFill } from '../../../r3f/fog/fogVolumeObject';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { decodeFogMaterial } from '../../../resources/materials/fogmaterial/decode';
import { useProceduralTexture3D } from '../../../resources/useProceduralTexture';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { Node3D } from '../../base/node3d/Component';
import type { FogVolumeProperties } from './types';

const DEFAULT_FILL: FogVolumeFill = { kind: 'default' };
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
  return DEFAULT_FILL;
}

/** `fill` with the FogMaterial's density texture, once built. */
function withDensityTexture(fill: FogVolumeFill, texture: THREE.Texture | null): FogVolumeFill {
  if (fill.kind !== 'material' || !(texture instanceof THREE.Data3DTexture)) return fill;
  return { ...fill, densityTexture: texture };
}

export function FogVolume({ node, children }: NodeComponentProps) {
  const properties = node.properties as FogVolumeProperties;
  const invalidate = useThree((state) => state.invalidate);
  const volume = useMemo(() => new FogVolumeObject(), []);
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
  const size = animatedSize ?? properties.size;

  useEffect(() => {
    // `size.maxf(0)` clamps an animated size as it does an authored one (`fog_volume.cpp:78`).
    volume.size.set(Math.max(0, size.x), Math.max(0, size.y), Math.max(0, size.z));
    volume.shape = properties.shape;
    volume.fill = fill;
    invalidate();
  }, [volume, size, properties.shape, fill, invalidate]);

  return (
    <Node3D node={node}>
      <primitive object={volume} />
      {children}
    </Node3D>
  );
}
