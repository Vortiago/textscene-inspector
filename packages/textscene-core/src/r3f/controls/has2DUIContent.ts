/**
 * Two questions about 2D UI that must not share one answer.
 *
 * {@link is2DUIType} asks what GODOT would claim — any `Control` subclass, or a
 * `CanvasLayer` — and derives it from the engine's own ancestry, so a Control
 * this previewer has no component for still classifies as 2D UI. That is the
 * question the workspace rules and the "switch to 2D" hint ask (ADR-0006).
 *
 * {@link TWO_D_UI_TYPES} asks what this previewer can DRAW: a literal mirror of
 * ControlComponentRegistry's registered types, held to it by
 * `has2DUIContent.driftguard.test.ts`. The registry can't be queried here
 * because it's lazy-loaded (empty until the native Control canvas mounts, which
 * only happens in 2D mode), so the set is hand-maintained — keep it in sync when adding a
 * Control slice that ships a component.
 *
 * Answering the first question with the second is what put 43 of Godot's 65
 * Control types on the 3D side of the workspace split: every Control slice
 * scaffolded for the linter without a painter fell out of the set, and a
 * scene rooted at one opened in the 3D canvas with no way to reach 2D.
 *
 * Light module (no component/THREE imports) — safe for the shell's
 * initial-paint bundle; `godot/` is data-only and imports nothing.
 */

import type { TscnNode } from '../../parser/types';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';

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
  'AspectRatioContainer',
  'BaseButton',
  'BoxContainer',
  'CheckButton',
  'Container',
  'FlowContainer',
  'HFlowContainer',
  'HScrollBar',
  'HSeparator',
  'LinkButton',
  'NinePatchRect',
  'ProgressBar',
  'Range',
  'ReferenceRect',
  'SplitContainer',
  'TextureButton',
  'TextureProgressBar',
  'VFlowContainer',
  'VScrollBar',
  'VSeparator',
  'CodeEdit',
  'ColorPicker',
  'ColorPickerButton',
  'FoldableContainer',
  'GraphEdit',
  'GraphElement',
  'GraphFrame',
  'GraphNode',
  'ItemList',
  'MenuBar',
  'MenuButton',
  'SpinBox',
  'TabBar',
  'TabContainer',
  'TextEdit',
  'Tree',
  'VideoStreamPlayer',
  'CanvasLayer',
  // `ParallaxBackground extends CanvasLayer` (`parallax_background.h:34`), so
  // it is a canvas boundary in the Control walk exactly as a plain CanvasLayer
  // is — see `parallaxbackground/index.r3f.ts`.
  'ParallaxBackground',
  // A Control like any other for the purposes of this set, which mirrors the
  // Control COMPONENT registry. The 3D dispatcher subtracts it separately via
  // `isViewportSurface` — see ADR-0033.
  'SubViewportContainer',
]);

/**
 * True when Godot's CanvasItemEditor would claim this type as 2D UI: any
 * `Control` subclass, or a `CanvasLayer`.
 *
 * `CanvasLayer` derives from `Node`, not from `CanvasItem`, so it is named
 * rather than walked to — it is in this answer because it ROOTS a 2D UI
 * subtree, which is what the workspace rules are asking about.
 */
export function is2DUIType(type: string): boolean {
  return type === 'CanvasLayer' || descendsFrom(type, 'Control');
}

/** True when any node in the subtree is a 2D-UI (Control/CanvasLayer) type. */
export function has2DUIContent(nodes: readonly TscnNode[]): boolean {
  for (const node of nodes) {
    if (is2DUIType(node.type)) return true;
    if (has2DUIContent(node.children)) return true;
  }
  return false;
}
