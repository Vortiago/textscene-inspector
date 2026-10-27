/**
 * The editor gizmo of a Camera3D: Godot's lines in the camera colour, on the node's own transform.
 * `h_offset` and `v_offset` move only the camera (`camera_3d.cpp:253-258`), so the gizmo is not a
 * child of it. Godot draws it for every node (`camera_3d_gizmo_plugin.cpp:258`).
 */

import { useMemo } from 'react';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useViewportSize } from '../../../r3f/contexts/ViewportSizeContext';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { cameraGizmoLines } from './gizmoLines';
import type { CameraLens } from './projectionFit';

/** `editors/3d_gizmos/gizmo_colors/camera` (`editor_settings.cpp:883`). */
const GIZMO_COLOUR = godotColorToLinear({ r: 0.8, g: 0.4, b: 0.8 });

interface CameraGizmoProps {
  lens: CameraLens;
  /** The `near` property, which the frustum projection reads. */
  near: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export function CameraGizmo({ lens, near, position, rotation, scale }: CameraGizmoProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <PluginGizmo drawnFor="every-node">
        <CameraGizmoLines lens={lens} near={near} />
      </PluginGizmo>
    </group>
  );
}

/** Split from the gate, so a hidden gizmo builds no lines. */
function CameraGizmoLines({ lens, near }: Pick<CameraGizmoProps, 'lens' | 'near'>) {
  const { x, y } = useViewportSize();
  const aspect = x / y;
  const positions = useMemo(() => cameraGizmoLines({ lens, near, aspect }), [lens, near, aspect]);
  return <GizmoLine positions={positions} color={GIZMO_COLOUR} />;
}
