/**
 * <AudioStreamPlayer3D>: the previewer plays no audio, so the node renders an editor-only audible
 * range and emission cone at its transform, as the light gizmos in `lights/shared/lightHelpers.tsx`
 * do. The node icon is the dispatcher's. `userData.isAudioGizmo` marks the group as an editor
 * widget. Children render beside the gizmo, so the node behaves like a transform node.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import type { AudioStreamPlayer3DProperties } from './types';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { degToRad, TAU } from '../../../godot/math/math.js';
import { BillboardMode } from '../../../godot/rendering/materials/billboardMode';
import { AttenuationModel } from '../../../godot/scene/audio';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** Editor-only gizmo colour: yellow, to match the light helpers. */
const GIZMO_COLOR = 0xffff00;

export function AudioStreamPlayer3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as AudioStreamPlayer3DProperties;

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // Godot's AudioStreamPlayer3DGizmoPlugin draws the audible range whenever the node attenuates
  // at all or declares a hard cutoff. It reads `unit_size` only for the radius.
  const rangeRadius = audibleRangeRadius(properties);

  // Godot adds the range and cone gizmos only for the selected node (`audio_stream_player_3d_gizmo_plugin.cpp:127`),
  // as for the lights. The `<group>` stays mounted, so the children keep their transform context.
  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ isAudioGizmo: true, nodeType: 'AudioStreamPlayer3D' }}
    >
      <PluginGizmo drawnFor="selected-only">
        {rangeRadius !== null && <RangeCircle radius={rangeRadius} />}
        {rangeRadius !== null && properties.emission_angle_enabled && (
          <EmissionCone radius={rangeRadius} angleDegrees={properties.emission_angle_degrees} />
        )}
      </PluginGizmo>
      {children}
    </group>
  );
}

interface RangeCircleProps {
  radius: number;
}

/** Vertex count around the range circle, smooth enough at any screen size. */
const RANGE_CIRCLE_SEGMENTS = 64;

/**
 * The audible-range gizmo: a camera-facing circle of lines, not a sphere, as Godot's
 * `AudioStreamPlayer3DGizmoPlugin` draws it. The default radius is `unit_size 10 x soft_multiplier
 * 12 = 120` world units, so a wireframe sphere would put the camera inside a grid that swamps the
 * scene.
 */
function RangeCircle({ radius }: RangeCircleProps) {
  const groupRef = useRef<THREE.Object3D | null>(null);
  useBillboard(groupRef, BillboardMode.BILLBOARD_ENABLED);

  const positions = useMemo(() => {
    const verts = new Float32Array(RANGE_CIRCLE_SEGMENTS * 6);
    for (let i = 0; i < RANGE_CIRCLE_SEGMENTS; i++) {
      const a = (i / RANGE_CIRCLE_SEGMENTS) * TAU;
      const b = ((i + 1) / RANGE_CIRCLE_SEGMENTS) * TAU;
      verts.set(
        [Math.cos(a) * radius, Math.sin(a) * radius, 0, Math.cos(b) * radius, Math.sin(b) * radius, 0],
        i * 6
      );
    }
    return verts;
  }, [radius]);

  return (
    <group ref={groupRef} userData={{ isAudioRangeSphere: true }}>
      <GizmoLine positions={positions} color={GIZMO_COLOR} />
    </group>
  );
}

function audibleRangeRadius(properties: AudioStreamPlayer3DProperties): number | null {
  const disabled = properties.attenuation_model === AttenuationModel.DISABLED;
  if (disabled && properties.max_distance <= 0) return null;
  const radius = properties.unit_size * SOFT_MULTIPLIER[properties.attenuation_model];
  const clamped = properties.max_distance > 0 ? Math.min(radius, properties.max_distance) : radius;
  return clamped > 0 ? clamped : null;
}

/** `soft_multiplier` per attenuation model, from the gizmo plugin source. */
const SOFT_MULTIPLIER: Record<EnumValue<typeof AttenuationModel>, number> = {
  [AttenuationModel.INVERSE_DISTANCE]: 12,
  [AttenuationModel.INVERSE_SQUARE_DISTANCE]: 4,
  [AttenuationModel.LOGARITHMIC]: 3.25,
  [AttenuationModel.DISABLED]: 10000,
};

interface EmissionConeProps {
  /** The audible-range radius the cone is drawn out to. */
  radius: number;
  /** Godot's `emission_angle_degrees`: the half-angle from the forward axis. */
  angleDegrees: number;
}

/**
 * The emission cone Godot draws when `emission_angle_enabled` is on: four ribs from the origin,
 * closed by a circle at the base. `emission_angle_degrees` is the half-angle off the forward (-Z)
 * axis, so the base radius is `range x tan(angle)`, clamped just under 90 degrees, where the
 * tangent diverges.
 */
function EmissionCone({ radius, angleDegrees }: EmissionConeProps) {
  const positions = useMemo(() => {
    const clamped = Math.min(Math.max(angleDegrees, 0), 89.9);
    const base = radius * Math.tan(degToRad(clamped));
    const ribs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ribs.push(0, 0, 0, Math.cos(a) * base, Math.sin(a) * base, -radius);
    }
    for (let i = 0; i < RANGE_CIRCLE_SEGMENTS; i++) {
      const a = (i / RANGE_CIRCLE_SEGMENTS) * TAU;
      const b = ((i + 1) / RANGE_CIRCLE_SEGMENTS) * TAU;
      ribs.push(
        Math.cos(a) * base,
        Math.sin(a) * base,
        -radius,
        Math.cos(b) * base,
        Math.sin(b) * base,
        -radius
      );
    }
    return new Float32Array(ribs);
  }, [radius, angleDegrees]);

  return (
    <group userData={{ isAudioEmissionCone: true }}>
      <GizmoLine positions={positions} color={GIZMO_COLOR} />
    </group>
  );
}
