/**
 * The billboard icon of one node, from the `editorIcon` its type registers. Godot's gizmo plugins add
 * it for every node, selected or not, so the gate draws it whenever the Gizmos toggle is on.
 */

import type { Rgba } from '../../godot/math/math';
import type { TscnNode } from '../../parser/types';
import { PluginGizmo } from '../gizmo/PluginGizmo';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { BillboardIcon } from './BillboardIcon';

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

export function NodeEditorIcon({ node }: { node: TscnNode }) {
  const registration = nodeComponentRegistry.editorIconOf(node.type);
  if (!registration || registration.isDrawn?.(node) === false) return null;
  return (
    <PluginGizmo drawnFor="every-node">
      <BillboardIcon icon={registration.icon} modulate={registration.modulate?.(node) ?? WHITE} />
    </PluginGizmo>
  );
}
