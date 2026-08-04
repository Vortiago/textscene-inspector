/**
 * Detects whether a scene contains 2D-UI (Control / CanvasLayer) nodes, so the
 * shell can surface a "switch to 2D" hint in 3D mode (ADR-0006). The type set
 * is a literal mirror of ControlComponentRegistry's registered types — the
 * registry can't be queried here because it's lazy-loaded (empty until the
 * native Control canvas mounts, which only happens in 2D mode). Keep in sync
 * when adding a Control slice. Light module (no component/THREE imports) —
 * safe for the shell's initial-paint bundle.
 */

import type { TscnNode } from '../../parser/types';

export const TWO_D_UI_TYPES = new Set<string>([
  'Control',
  'ColorRect',
  'Label',
  'VBoxContainer',
  'HBoxContainer',
  'HSplitContainer',
  'VSplitContainer',
  'GridContainer',
  'CenterContainer',
  'MarginContainer',
  'ScrollContainer',
  'Panel',
  'PanelContainer',
  'Button',
  'CheckBox',
  'OptionButton',
  'LineEdit',
  'HSlider',
  'VSlider',
  'TextureRect',
  'RichTextLabel',
  'CanvasLayer',
  // A Control like any other for the purposes of this set (which mirrors the
  // Control registry and drives the 2D hint + root-workspace rule). The 3D
  // dispatcher subtracts it separately via `isViewportSurface` — see ADR-0030.
  'SubViewportContainer',
]);

/** True when any node in the subtree is a 2D-UI (Control/CanvasLayer) type. */
export function has2DUIContent(nodes: readonly TscnNode[]): boolean {
  for (const node of nodes) {
    if (TWO_D_UI_TYPES.has(node.type)) return true;
    if (has2DUIContent(node.children)) return true;
  }
  return false;
}
