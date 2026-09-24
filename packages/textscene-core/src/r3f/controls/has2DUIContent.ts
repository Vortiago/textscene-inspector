/**
 * Two questions about 2D UI that must not share one answer: what Godot would
 * claim ({@link is2DUIType}) and what this previewer can draw ({@link TWO_D_UI_TYPES}).
 * No component or THREE import: the shell's initial-paint bundle loads it.
 */

import type { TscnNode } from '../../parser/types';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';

/**
 * What this previewer can draw: a hand-kept mirror of ControlComponentRegistry,
 * which stays empty until the 2D canvas mounts. `has2DUIContent.driftguard.test.ts`
 * holds the two equal. It never answers the workspace question.
 */
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
  // it is a canvas boundary in the Control walk.
  'ParallaxBackground',
  // The 3D dispatcher subtracts it separately with `isViewportSurface`
  // (ADR-0033).
  'SubViewportContainer',
]);

/**
 * True when Godot's CanvasItemEditor would claim this type as 2D UI (ADR-0006),
 * so a Control with no painter still opens in 2D. `CanvasLayer` derives from
 * `Node`, so it is named: it roots a 2D UI subtree.
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
