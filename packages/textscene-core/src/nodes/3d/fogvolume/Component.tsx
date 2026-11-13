/**
 * <FogVolume>: puts a fog volume into the scene at the node's transform, which the volumetric fog
 * finds and draws (`r3f/fog/fogVolumeRows.ts`). It draws nothing of its own, so it draws nothing
 * where the Environment's volumetric fog is off, as in Godot. Godot's editor gizmo of the box draws
 * for every node, faint while unselected (ADR-0056).
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { fogVolumeAabb, fogVolumeSize } from '../../../godot/rendering/environment/fogVolume';
import * as logger from '../../../logger';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { NodeAabb } from '../../../r3f/components/NodeAabb';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import {
  DEFAULT_FOG_VOLUME_FILL,
  FogVolumeObject,
  type FogVolumeFill,
} from '../../../r3f/fog/fogVolumeObject';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { FOG_VOLUME_MATERIAL, type FogVolumeMaterial } from '../../../resources/materials/fogmaterial';
import { useNodeResource, type Read } from '../../../resources/reading';
import { useTexture3D } from '../../../resources/useTexture3D';
import { Node3D } from '../../base/node3d/Component';
import { FogVolumeGizmo } from './Gizmo';
import type { FogVolumeProperties } from './types';
import type { Vector3 } from '../../../godot/math/vector';

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const FogVolumeElement = extend(FogVolumeObject);

/**
 * What fills a volume while its density texture loads. The previewer runs no fog shader, so a
 * volume with one adds no fog. A material still loading counts as a fog shader until it arrives.
 */
function fillOf(material: Read<FogVolumeMaterial>): FogVolumeFill {
  if (material.status === 'pending' || material.value?.kind === 'shader') return { kind: 'shader' };
  if (material.value?.kind !== 'material') return DEFAULT_FOG_VOLUME_FILL;
  return { kind: 'material', material: material.value.material, densityTexture: null };
}

/** Written only by useFogShaderNotRunLog. A WeakSet lets a dropped material be collected. */
const loggedFogShaders = new WeakSet<FogVolumeMaterial>();

/** Logs once per material that the previewer adds no fog for its loaded fog shader. */
function useFogShaderNotRunLog(material: FogVolumeMaterial | null): void {
  useEffect(() => {
    if (material?.kind !== 'shader' || loggedFogShaders.has(material)) return;
    loggedFogShaders.add(material);
    logger.info(
      `[FogVolume] Adds no fog for the fog shader ${material.shader}, which the previewer does not run`
    );
  }, [material]);
}

/** `fill` with the FogMaterial's density texture, once built or loaded. */
function withDensityTexture(fill: FogVolumeFill, texture: THREE.Data3DTexture | null): FogVolumeFill {
  if (fill.kind !== 'material' || !texture) return fill;
  return { ...fill, densityTexture: texture };
}

/** The density texture of a FogMaterial, once built or loaded. It resolves in the tables of the FogMaterial. */
function useDensityTexture(material: FogVolumeMaterial | null): THREE.Data3DTexture | null {
  return useTexture3D(material?.kind === 'material' ? material.densityTexture : null);
}

export function FogVolume({ node, children }: NodeComponentProps) {
  const properties = node.properties as FogVolumeProperties;
  const material = useNodeResource(properties.material, FOG_VOLUME_MATERIAL);
  useFogShaderNotRunLog(material.value);
  const materialFill = useMemo(() => fillOf(material), [material]);
  const densityTexture = useDensityTexture(material.value);
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
  const size = useMemo(
    () => (animatedSize ? fogVolumeSize(animatedSize) : properties.size),
    [animatedSize, properties.size]
  );

  const aabb = useMemo(() => fogVolumeAabb(properties.shape, size), [properties.shape, size]);

  return (
    <Node3D node={node}>
      <NodeAabb aabb={aabb} />
      <FogVolumeElement size={[size.x, size.y, size.z]} shape={properties.shape} fill={fill} />
      <PluginGizmo drawnFor="every-node">
        <FogVolumeGizmo size={size} shape={properties.shape} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
