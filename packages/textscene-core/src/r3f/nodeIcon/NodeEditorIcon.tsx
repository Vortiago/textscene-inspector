/**
 * The billboard icon of one node, from the `editorIcon` its type registers. Godot's gizmo plugins add
 * it for every node, selected or not, so the gate draws it whenever the Gizmos toggle is on.
 */

import type { TscnNode } from '../../parser/types';
import { PluginGizmo } from '../gizmo/PluginGizmo';
import { BillboardIcon } from './BillboardIcon';
import type { EditorIconRegistration } from './editorIconRegistration';

interface NodeEditorIconProps {
  node: TscnNode;
  registration: EditorIconRegistration;
}

export function NodeEditorIcon({ node, registration }: NodeEditorIconProps) {
  if (registration.isDrawn?.(node) === false) return null;
  return (
    <PluginGizmo drawnFor="every-node">
      <BillboardIcon node={node} registration={registration} />
    </PluginGizmo>
  );
}
