/**
 * <VisibleOnScreenNotifier3D> and <VisibleOnScreenEnabler3D> draw nothing at runtime. Godot's editor
 * draws the box they watch, and here `useGizmoVisible()` shows it only while selected (ADR-0018).
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { AabbAxesGizmo } from '../../../r3f/components/AabbAxesGizmo';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { Node3D } from '../../base/node3d/Component';
import type { VisibleOnScreenNotifier3DProperties } from './types';

/** `editors/3d_gizmos/gizmo_colors/visibility_notifier` (`editor_settings.cpp:895`). */
const GIZMO_COLOR = Object.freeze({ r: 0.8, g: 0.5, b: 0.7 });

/** The alpha of the solid material (`visible_on_screen_notifier_3d_gizmo_plugin.cpp:40`). */
const SOLID_ALPHA = 0.1;

export function VisibleOnScreenNotifier3D({ node, children }: NodeComponentProps) {
  const { aabb } = node.properties as VisibleOnScreenNotifier3DProperties;
  const gizmoVisible = useGizmoVisible();
  return (
    <Node3D node={node}>
      {gizmoVisible && <AabbAxesGizmo aabb={aabb} color={GIZMO_COLOR} solidAlpha={SOLID_ALPHA} />}
      {children}
    </Node3D>
  );
}
