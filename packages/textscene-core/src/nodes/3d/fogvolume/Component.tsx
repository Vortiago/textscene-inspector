/**
 * <FogVolume>: puts a fog volume into the scene at the node's transform, which the volumetric fog
 * finds and draws (`r3f/fog/fogVolumeRows.ts`). It draws nothing of its own, so it draws nothing
 * where the Environment's volumetric fog is off, as in Godot.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { fogVolumeSize } from '../../../godot/rendering/environment/fogVolume';
import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import { literalText, stringToInt } from '../../../godot/string/string';
import * as logger from '../../../logger';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import {
  DEFAULT_FOG_VOLUME_FILL,
  FogVolumeObject,
  type FogVolumeFill,
} from '../../../r3f/fog/fogVolumeObject';
import type { TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { NO_RESOURCES, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { decodeFogMaterial } from '../../../resources/materials/fogmaterial/decode';
import { useResourceResolution, type ScopedResource } from '../../../resources/useSubOrExtResource';
import { useTexture3D } from '../../../resources/useTexture3D';
import { Node3D } from '../../base/node3d/Component';
import type { FogVolumeProperties } from './types';
import type { Vector3 } from '../../../godot/math/vector';

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const FogVolumeElement = extend(FogVolumeObject);

/** The mode `shader` runs in, or null for a shader this cannot read, such as a `.gdshader` file. */
function shaderModeOfResource(shader: TscnInternalResource | null): ShaderMode | null {
  if (!shader) return null;
  if (shader.type === 'VisualShader') return stringToInt(shader.data['mode'] ?? '0');
  return shaderModeOf(literalText(shader.data['code'] ?? ''));
}

/**
 * Whether `material` is a ShaderMaterial whose shader Godot runs as a fog shader. A shader it
 * cannot read counts as one.
 */
function hasFogShader(material: TscnInternalResource | null, shader: TscnInternalResource | null): boolean {
  if (material?.type !== 'ShaderMaterial' || !material.data['shader']) return false;
  const mode = shaderModeOfResource(shader);
  return mode === null || mode === ShaderMode.FOG;
}

/**
 * What fills a volume with this material. Godot runs the default fog shader for anything but a
 * FogMaterial or a valid fog shader (`environment/fog.cpp:672-683`). The previewer runs no fog
 * shader, so a volume with one adds no fog.
 */
function fillOf(material: TscnInternalResource | null, isFogShader: boolean): FogVolumeFill {
  if (isFogShader) return { kind: 'shader' };
  if (material?.type !== 'FogMaterial') return DEFAULT_FOG_VOLUME_FILL;
  return { kind: 'material', material: decodeFogMaterial(material.data), densityTexture: null };
}

/** Written only by logFogShaderNotRun. A WeakSet lets a dropped material be collected. */
const loggedShaderMaterials = new WeakSet<TscnInternalResource>();

function logFogShaderNotRun(material: TscnInternalResource): void {
  if (loggedShaderMaterials.has(material)) return;
  loggedShaderMaterials.add(material);
  logger.info(
    `[FogVolume] Adds no fog for the fog shader ${material.data['shader']}, which the previewer does not run`
  );
}

/** What fills a volume with the material `scoped` holds, which logs a fog shader it does not run. */
function useMaterialFill(scoped: ScopedResource | null): FogVolumeFill {
  const material = scoped?.resource ?? null;
  const shader = useResourceResolution(material?.data['shader'], scoped?.resources ?? NO_RESOURCES);
  const shaderResource = shader.scoped?.resource ?? null;
  const isFogShader = useMemo(() => hasFogShader(material, shaderResource), [material, shaderResource]);
  // A `.tres` shader still loading reads as a fog shader until its code arrives.
  const isShaderSettled = shader.status !== 'pending';
  useEffect(() => {
    if (material && isFogShader && isShaderSettled) logFogShaderNotRun(material);
  }, [material, isFogShader, isShaderSettled]);
  return useMemo(() => fillOf(material, isFogShader), [material, isFogShader]);
}

/** `fill` with the FogMaterial's density texture, once built or loaded. */
function withDensityTexture(fill: FogVolumeFill, texture: THREE.Data3DTexture | null): FogVolumeFill {
  if (fill.kind !== 'material' || !texture) return fill;
  return { ...fill, densityTexture: texture };
}

export function FogVolume({ node, children }: NodeComponentProps) {
  const properties = node.properties as FogVolumeProperties;
  const { scoped } = useResourceResolution(properties.material, useSceneResources());
  const materialFill = useMaterialFill(scoped);
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
