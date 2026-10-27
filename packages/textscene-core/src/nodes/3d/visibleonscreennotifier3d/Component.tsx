/**
 * <VisibleOnScreenNotifier3D> and <VisibleOnScreenEnabler3D> draw nothing at runtime. Godot's editor
 * draws the box they watch for every node, faint while unselected, and a fill for the selected node
 * (`visible_on_screen_notifier_3d_gizmo_plugin.cpp:185-191`, ADR-0056).
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { AabbAxesGizmo } from '../../../r3f/components/AabbAxesGizmo';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { Node3D } from '../../base/node3d/Component';
import type { VisibleOnScreenNotifier3DProperties } from './types';

/** `editors/3d_gizmos/gizmo_colors/visibility_notifier` (`editor_settings.cpp:895`). */
const GIZMO_COLOR = Object.freeze({ r: 0.8, g: 0.5, b: 0.7 });

/** The alpha of the solid material (`visible_on_screen_notifier_3d_gizmo_plugin.cpp:40`). */
const SOLID_ALPHA = 0.1;

export function VisibleOnScreenNotifier3D({ node, children }: NodeComponentProps) {
  const { aabb } = node.properties as VisibleOnScreenNotifier3DProperties;
  return (
    <Node3D node={node}>
      <PluginGizmo drawnFor="every-node">
        <AabbAxesGizmo aabb={aabb} color={GIZMO_COLOR} solidAlpha={SOLID_ALPHA} />
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
