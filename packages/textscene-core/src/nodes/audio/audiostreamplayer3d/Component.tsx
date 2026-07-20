/**
 * <AudioStreamPlayer3D> — non-rendered audio source visualised as a
 * speaker-icon gizmo at the node's transform.
 *
 * Audio playback is intentionally not supported in the previewer; this
 * component closes the parity gap by rendering a small editor-only
 * cone-and-disk silhouette (a stylised speaker) plus an optional
 * wireframe sphere showing the `unit_size` audible range. Pattern
 * mirrors the light gizmos in `lights/shared/lightHelpers.tsx`.
 *
 * The cone group is tagged `userData.isAudioGizmo = true` so the
 * helper / selection systems can identify it as an editor-only widget
 * rather than a user-authored mesh.
 *
 * Children pass through unchanged — `node.children` are dispatched
 * by `NodeDispatcher` and rendered alongside the gizmo so the audio
 * node behaves like a transform node in the tree.
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

/** Editor-only gizmo colour — yellow to match the light helpers. */
const GIZMO_COLOR = 0xffff00;
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

  // Godot's AudioStreamPlayer3DGizmoPlugin draws the audible range whenever the
  // node attenuates at all or declares a hard cutoff — it never consults
  // `unit_size` for the DECISION, only for the radius. (We used to suppress the
  // gizmo at exactly `unit_size === 10`, which is the default nearly every
  // corpus node carries, so it was almost never drawn.)
  const rangeRadius = audibleRangeRadius(properties);

  // Gate the editor-only speaker + range gizmo on selection,
  // same as Camera3D and the light gizmos. Without this, every audio
  // node in the scene drew a yellow wireframe cone/disk + range sphere
  // regardless of selection — main's HelperManager rendered nothing for
  // unselected audio nodes (ui-designer-2's A/B on the hallway fixture).
  // The `<group>` itself stays mounted so the transform context is
  // preserved for the node's children; only the visual gizmo content
  // is conditional.
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
 * The speaker silhouette: a small cone whose narrow end points away
 * from the camera-ward (-Z) direction, paired with a thin disk for
 * the front baffle. Lights don't cast shadows in this gizmo; the
 * mesh is purely visual.
 */
function SpeakerGizmo() {
  return (
    <group userData={{ isAudioGizmoBody: true }}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry
          args={[SPEAKER_BODY_RADIUS, SPEAKER_BODY_HEIGHT, 16, 1, true]}
        />
        <meshBasicMaterial color={GIZMO_COLOR} wireframe />
      </mesh>
      <mesh position={[0, 0, -SPEAKER_BODY_HEIGHT / 2]}>
        <cylinderGeometry
          args={[SPEAKER_FRONT_RADIUS, SPEAKER_FRONT_RADIUS, SPEAKER_FRONT_THICKNESS, 24]}
        />
        <meshBasicMaterial color={GIZMO_COLOR} wireframe />
      </mesh>
    </group>
  );
}

interface RangeCircleProps {
  radius: number;
}

/** Vertex count around the range circle — smooth enough at any screen size. */
const RANGE_CIRCLE_SEGMENTS = 64;

/**
 * The audible-range gizmo: a CAMERA-FACING CIRCLE OF LINES, not a sphere.
 *
 * That is what Godot's `AudioStreamPlayer3DGizmoPlugin` draws, and the choice is
 * deliberate on their side ("This helps distinguish AudioStreamPlayer3D gizmos
 * from OmniLight3D gizmos"). It also matters here: the default radius is
 * `unit_size 10 x soft_multiplier 12 = 120` world units, so a wireframe sphere
 * puts the camera inside a grid that swamps the whole scene, while an outline
 * stays readable.
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
  /** Godot's `emission_angle_degrees` — the HALF-angle from the forward axis. */
  angleDegrees: number;
}

/**
 * The directional emission cone Godot draws when `emission_angle_enabled` is on:
 * four rib lines from the node's origin out along the cone, closed by a circle
 * at the base. `emission_angle_degrees` is the half-angle off the node's forward
 * (-Z) axis, so the base radius is `range x tan(angle)`. Clamped just under 90
 * degrees, where the tangent diverges and the cone becomes a half-space.
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
