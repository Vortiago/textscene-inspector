/**
 * <FogVolume>: puts a fog volume into the scene at the node's transform, which the volumetric fog
 * finds and draws (`r3f/fog/fogVolumeRows.ts`). It draws nothing of its own, so it draws nothing
 * where the Environment's volumetric fog is off, as in Godot. Godot's editor gizmo of the box draws
 * while the node is selected (ADR-0018).
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { fogVolumeSize } from '../../../godot/rendering/environment/fogVolume';
import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import { holdsResource } from '../../../godot/scene/resourceLiteral';
import { literalText, stringToInt } from '../../../godot/string/string';
import * as logger from '../../../logger';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
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
import { FogVolumeGizmo } from './Gizmo';
import type { FogVolumeProperties } from './types';
import type { Vector3 } from '../../../godot/math/vector';
import { enumMember, type EnumValue } from '../../../godot/classdb/enumNames.js';

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const FogVolumeElement = extend(FogVolumeObject);

/** The mode `shader` runs in, or null before it has loaded. */
function shaderModeOfResource(shader: TscnInternalResource | null): EnumValue<typeof ShaderMode> | null {
  if (!shader) return null;
  // `VisualShader::set_mode` refuses an out-of-range mode (`visual_shader.cpp:1436`), so it keeps the default.
  if (shader.type === 'VisualShader')
    return enumMember(ShaderMode, stringToInt(shader.data['mode'] ?? '0')) ?? ShaderMode.SPATIAL;
  return shaderModeOf(literalText(shader.data['code'] ?? ''));
}

/** Whether a ShaderMaterial's shader runs as a fog shader, and whether its shader has loaded. */
interface FogShaderVerdict {
  isFogShader: boolean;
  isSettled: boolean;
}

/**
 * Whether the material `scoped` holds is a ShaderMaterial whose shader Godot runs as a fog shader.
 * A shader still loading counts as one until its code arrives. A null, missing or unreadable shader
 * leaves the material data invalid, which Godot fills with its default fog (`fog.cpp:674-684`).
 */
function useFogShaderVerdict(scoped: ScopedResource | null): FogShaderVerdict {
  const material = scoped?.resource ?? null;
  const shaderRef = material?.type === 'ShaderMaterial' ? material.data['shader'] : undefined;
  const shader = useResourceResolution(shaderRef, scoped?.resources ?? NO_RESOURCES);
  const mode = useMemo(() => shaderModeOfResource(shader.scoped?.resource ?? null), [shader.scoped]);
  const isFogShader = holdsResource(shaderRef) && (shader.status === 'pending' || mode === ShaderMode.FOG);
  const isSettled = shader.status !== 'pending';
  return useMemo(() => ({ isFogShader, isSettled }), [isFogShader, isSettled]);
}

/**
 * What fills a volume with this material. Godot runs the default fog shader for anything but a
 * FogMaterial or a valid fog shader (`environment/fog.cpp:674-684`). The previewer runs no fog
 * shader, so a volume with one adds no fog.
 */
function fillOf(material: TscnInternalResource | null, isFogShader: boolean): FogVolumeFill {
  if (isFogShader) return { kind: 'shader' };
  if (material?.type !== 'FogMaterial') return DEFAULT_FOG_VOLUME_FILL;
  return { kind: 'material', material: decodeFogMaterial(material.data), densityTexture: null };
}

/** Written only by useFogShaderNotRunLog. A WeakSet lets a dropped material be collected. */
const loggedShaderMaterials = new WeakSet<TscnInternalResource>();

/** Logs once per material that the previewer adds no fog for its loaded fog shader. */
function useFogShaderNotRunLog(material: TscnInternalResource | null, verdict: FogShaderVerdict): void {
  useEffect(() => {
    if (!material || !verdict.isFogShader || !verdict.isSettled) return;
    if (loggedShaderMaterials.has(material)) return;
    loggedShaderMaterials.add(material);
    logger.info(
      `[FogVolume] Adds no fog for the fog shader ${material.data['shader']}, which the previewer does not run`
    );
  }, [material, verdict]);
}

/** `fill` with the FogMaterial's density texture, once built or loaded. */
function withDensityTexture(fill: FogVolumeFill, texture: THREE.Data3DTexture | null): FogVolumeFill {
  if (fill.kind !== 'material' || !texture) return fill;
  return { ...fill, densityTexture: texture };
}

export function FogVolume({ node, children }: NodeComponentProps) {
  const properties = node.properties as FogVolumeProperties;
  const { scoped } = useResourceResolution(properties.material, useSceneResources());
  const material = scoped?.resource ?? null;
  const fogShader = useFogShaderVerdict(scoped);
  useFogShaderNotRunLog(material, fogShader);
  const materialFill = useMemo(() => fillOf(material, fogShader.isFogShader), [material, fogShader]);
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
  const size = useMemo(
    () => (animatedSize ? fogVolumeSize(animatedSize) : properties.size),
    [animatedSize, properties.size]
  );
  const gizmoVisible = useGizmoVisible();

  return (
    <Node3D node={node}>
      <FogVolumeElement size={[size.x, size.y, size.z]} shape={properties.shape} fill={fill} />
      {gizmoVisible && <FogVolumeGizmo size={size} shape={properties.shape} />}
      {children}
    </Node3D>
  );
}
