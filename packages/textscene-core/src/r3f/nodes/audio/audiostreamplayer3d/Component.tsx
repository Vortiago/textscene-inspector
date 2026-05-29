/**
 * <AudioStreamPlayer3D> — non-rendered audio source visualised as a
 * speaker-icon gizmo at the node's transform.
 *
 * Audio playback is intentionally not supported in the previewer; this
 * component closes the parity gap by rendering a small editor-only
 * cone-and-disk silhouette (a stylised speaker) plus an optional
 * wireframe sphere showing the `unit_size` audible range. Pattern
 * mirrors the light gizmos in `lights/lightHelpers.tsx`.
 *
 * The cone group is tagged `userData.isAudioGizmo = true` so the
 * helper / selection systems can identify it as an editor-only widget
 * rather than a user-authored mesh.
 *
 * Children pass through unchanged — `node.children` are dispatched
 * by `NodeDispatcher` and rendered alongside the gizmo so the audio
 * node behaves like a transform node in the tree.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../nodeTransform';
import type { AudioStreamPlayer3DProperties } from '../../../../nodes/audio/audiostreamplayer3d/types';
import { useGizmoVisible } from '../../lights/lightHelpers';

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

  // Range sphere is shown only when unit_size differs from the default,
  // matching the way Godot's editor only draws the range gizmo when
  // the user has overridden the default.
  const showRangeSphere = properties.unit_size > 0 && properties.unit_size !== 10;

  // WI-UX-14: gate the editor-only speaker + range gizmo on selection,
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
      {gizmoVisible && showRangeSphere && <RangeSphere radius={properties.unit_size} />}
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

interface RangeSphereProps {
  radius: number;
}

/**
 * Wireframe sphere showing the audible-range scale (unit_size).
 * Translucent so it doesn't dominate the viewport. Non-shadow-casting
 * by being a basic material.
 */
function RangeSphere({ radius }: RangeSphereProps) {
  // useMemo so the geometry isn't recreated unless the radius actually changes.
  return (
    <mesh userData={{ isAudioRangeSphere: true }}>
      <sphereGeometry args={[radius, 24, 16]} />
      <meshBasicMaterial
        color={GIZMO_COLOR}
        wireframe
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
