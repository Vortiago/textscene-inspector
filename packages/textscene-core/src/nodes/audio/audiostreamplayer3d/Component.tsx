/**
 * <AudioStreamPlayer3D>: the previewer plays no audio, so the node renders an editor-only speaker
 * gizmo and its audible range at its transform, as the light gizmos in
 * `lights/shared/lightHelpers.tsx` do. `userData.isAudioGizmo` marks the cone group as an editor
 * widget. Children render beside the gizmo, so the node behaves like a transform node.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import type { AudioStreamPlayer3DProperties } from './types';
import { AttenuationModel } from './types';
import { useGizmoVisible } from '../../3d/lights/shared/lightHelpers';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useBillboard, BILLBOARD_ENABLED } from '../../../r3f/hooks/useBillboard';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';

/** Editor-only gizmo colour: yellow, to match the light helpers. */
const GIZMO_COLOR = 0xffff00;

/** Literal-only, so the key is constant and the speaker gizmo never remounts. */
const GIZMO_MATERIAL = wireGizmoProgram(GIZMO_COLOR);

/** Body of the speaker cone (small wireframe-friendly silhouette). */
const SPEAKER_BODY_RADIUS = 0.12;
const SPEAKER_BODY_HEIGHT = 0.18;
/** Front disk that gives the cone its "speaker" silhouette. */
const SPEAKER_FRONT_RADIUS = 0.18;
const SPEAKER_FRONT_THICKNESS = 0.02;

export function AudioStreamPlayer3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as AudioStreamPlayer3DProperties;

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // Godot's AudioStreamPlayer3DGizmoPlugin draws the audible range whenever the node attenuates
  // at all or declares a hard cutoff. It reads `unit_size` only for the radius.
  const rangeRadius = audibleRangeRadius(properties);

  // The speaker and range gizmos are selection-gated, as Camera3D and the light gizmos are. The
  // `<group>` stays mounted, so the children keep their transform context.
  const gizmoVisible = useGizmoVisible();

  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ isAudioGizmo: true, nodeType: 'AudioStreamPlayer3D' }}
    >
      {gizmoVisible && <SpeakerGizmo />}
      {gizmoVisible && rangeRadius !== null && <RangeCircle radius={rangeRadius} />}
      {gizmoVisible && rangeRadius !== null && properties.emission_angle_enabled && (
        <EmissionCone radius={rangeRadius} angleDegrees={properties.emission_angle_degrees} />
      )}
      {children}
    </group>
  );
}

/**
 * The speaker silhouette: a small cone whose narrow end points away from the camera-ward (-Z)
 * direction, and a thin disk for the front baffle. It casts no shadow.
 */
function SpeakerGizmo() {
  return (
    <group userData={{ isAudioGizmoBody: true }}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry
          args={[SPEAKER_BODY_RADIUS, SPEAKER_BODY_HEIGHT, 16, 1, true]}
        />
        <meshBasicMaterial key={GIZMO_MATERIAL.key} {...GIZMO_MATERIAL.props} />
      </mesh>
      <mesh position={[0, 0, -SPEAKER_BODY_HEIGHT / 2]}>
        <cylinderGeometry
          args={[SPEAKER_FRONT_RADIUS, SPEAKER_FRONT_RADIUS, SPEAKER_FRONT_THICKNESS, 24]}
        />
        <meshBasicMaterial key={GIZMO_MATERIAL.key} {...GIZMO_MATERIAL.props} />
      </mesh>
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
  useBillboard(groupRef, BILLBOARD_ENABLED);

  const positions = useMemo(() => {
    const verts = new Float32Array(RANGE_CIRCLE_SEGMENTS * 6);
    for (let i = 0; i < RANGE_CIRCLE_SEGMENTS; i++) {
      const a = (i / RANGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      const b = ((i + 1) / RANGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      verts.set(
        [
          Math.cos(a) * radius, Math.sin(a) * radius, 0,
          Math.cos(b) * radius, Math.sin(b) * radius, 0,
        ],
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
  const disabled = properties.attenuation_model === AttenuationModel.ATTENUATION_DISABLED;
  if (disabled && properties.max_distance <= 0) return null;
  const radius = properties.unit_size * SOFT_MULTIPLIER[properties.attenuation_model];
  const clamped = properties.max_distance > 0 ? Math.min(radius, properties.max_distance) : radius;
  return clamped > 0 ? clamped : null;
}

/** `soft_multiplier` per attenuation model, from the gizmo plugin source. */
const SOFT_MULTIPLIER: Record<AttenuationModel, number> = {
  [AttenuationModel.ATTENUATION_INVERSE_DISTANCE]: 12,
  [AttenuationModel.ATTENUATION_INVERSE_SQUARE_DISTANCE]: 4,
  [AttenuationModel.ATTENUATION_LOGARITHMIC]: 3.25,
  [AttenuationModel.ATTENUATION_DISABLED]: 10000,
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
    const base = radius * Math.tan((clamped * Math.PI) / 180);
    const ribs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ribs.push(0, 0, 0, Math.cos(a) * base, Math.sin(a) * base, -radius);
    }
    for (let i = 0; i < RANGE_CIRCLE_SEGMENTS; i++) {
      const a = (i / RANGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      const b = ((i + 1) / RANGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      ribs.push(
        Math.cos(a) * base, Math.sin(a) * base, -radius,
        Math.cos(b) * base, Math.sin(b) * base, -radius
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
