/**
 * <Node> — base Godot Node. No transform; renders children only.
 * Used for instance roots and non-3D nodes when they appear in a 3D scene tree.
 */

import type { NodeComponentProps } from '../../NodeComponentRegistry';

export function Node({ children }: NodeComponentProps) {
  return <group>{children}</group>;
}
