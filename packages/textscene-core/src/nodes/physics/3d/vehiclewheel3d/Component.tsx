/**
 * <VehicleWheel3D>: a transform group that positions the wheel's child mesh
 * (ADR-0005, ADR-0008) and draws the Godot wheel gizmo for every wheel, faint while the wheel is
 * not selected (`vehicle_body_3d_gizmo_plugin.cpp:100`, ADR-0056).
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { WheelGizmo } from './WheelGizmo';
import { VEHICLE_WHEEL_3D_DEFAULTS as DEFAULTS } from './types';
import type { VehicleWheel3DProperties } from './types';

export function VehicleWheel3D({ node, children }: NodeComponentProps) {
  const props = node.properties as VehicleWheel3DProperties;
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <WheelGizmo
          radius={props.wheel_radius ?? DEFAULTS.wheel_radius}
          restLength={props.wheel_rest_length ?? DEFAULTS.wheel_rest_length}
        />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
