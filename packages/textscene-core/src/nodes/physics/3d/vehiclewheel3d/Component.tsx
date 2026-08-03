/**
 * <VehicleWheel3D> — a transform group that positions the wheel's child mesh
 * (ADR-0005, ADR-0008) and draws the Godot wheel gizmo while selected.
 *
 * Godot draws that gizmo for every wheel at all times; we gate it on selection
 * via useGizmoVisible(), the same viewer-vs-editor divergence ADR-0018 records
 * for Marker3D and Path3D — a four-wheeled vehicle would otherwise fill the
 * viewport with coils.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { useGizmoVisible } from '../../../../r3f/hooks/useGizmoVisible';
import { WheelGizmo } from './WheelGizmo';
import { VEHICLE_WHEEL_3D_DEFAULTS as DEFAULTS } from './types';
import type { VehicleWheel3DProperties } from './types';

export function VehicleWheel3D({ node, children }: NodeComponentProps) {
  const props = node.properties as VehicleWheel3DProperties;
  const gizmoVisible = useGizmoVisible();
  return (
    <Node3D node={node}>
      {gizmoVisible && (
        <WheelGizmo
          radius={props.wheel_radius ?? DEFAULTS.wheel_radius}
          restLength={props.wheel_rest_length ?? DEFAULTS.wheel_rest_length}
        />
      )}
      {children}
    </Node3D>
  );
}
