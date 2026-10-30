/** What a node type registers to draw Godot's billboard icon at its origin (`NodeComponentRegistration.editorIcon`). */

import type { Rgba } from '../../godot/math/math';
import type { TscnNode } from '../../parser/types';
import type { EditorIconName } from './editorIcons';

export interface EditorIconRegistration {
  icon: EditorIconName;
  /** The vertex colour of the icon quad, which a light sets to its colour. White when absent. */
  modulate?: (node: TscnNode) => Rgba;
  /** False for a node whose gizmo plugin adds no icon. The icon draws when absent. */
  isDrawn?: (node: TscnNode) => boolean;
}
