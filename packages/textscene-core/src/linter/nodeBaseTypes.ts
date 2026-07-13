/**
 * Canonical node-type → base-type table for the linter's validator inheritance
 * (#143). `ValidatorRegistry.findValidator` walks this chain so the Node3D /
 * Node2D / Control base validator sets apply to every subclass automatically,
 * instead of each subclass silently escaping validation.
 *
 * Five levels carry validators today — `Node3D`, `Light3D`, `Node2D`,
 * `Control`, and the terminal `Node` — so leaves map straight to their nearest
 * validator-bearing ancestor rather than modelling every intermediate Godot
 * class. Every chain terminates at `Node` (which has no entry). Pure data:
 * React/THREE-free, so it stays on the linter side of the bundle boundary.
 */

/** Light3D-derived concrete nodes — each maps to `Light3D` then `Node3D`. */
const LIGHT3D_LEAVES = [
  'DirectionalLight3D',
  'OmniLight3D',
  'SpotLight3D',
  'AreaLight3D',
] as const;

/** Base for every spatial (3D) node — Node3D carries the transform/visible set. */
const NODE3D_LEAVES = [
  'MeshInstance3D',
  'Camera3D',
  'Sprite3D',
  'Label3D',
  'Decal',
  'GridMap',
  'Skeleton3D',
  'GPUParticles3D',
  'Marker3D',
  'CSGBox3D',
  'CSGCylinder3D',
  'CSGSphere3D',
  'Path3D',
  'PathFollow3D',
  'NavigationRegion3D',
  'AudioStreamPlayer3D',
  'Area3D',
  'StaticBody3D',
  'RigidBody3D',
  'CharacterBody3D',
  'CollisionShape3D',
  'RemoteTransform3D',
  'NavigationObstacle3D',
] as const;

/** Base for every canvas (2D) node — Node2D carries the transform/skew set. */
const NODE2D_LEAVES = [
  'Sprite2D',
  'AnimatedSprite2D',
  'Line2D',
  'Polygon2D',
  'Camera2D',
  'Marker2D',
  'Path2D',
  'PathFollow2D',
  'NavigationRegion2D',
  'AudioStreamPlayer2D',
  'TileMap',
  'TileMapLayer',
  'Area2D',
  'StaticBody2D',
  'RigidBody2D',
  'CharacterBody2D',
  'CollisionShape2D',
  'RemoteTransform2D',
] as const;

/**
 * Base for the Control (2D UI) family — Control carries the layout/anchor/offset
 * + theme-override set. `Control` and `CanvasLayer` are NOT in here: Control is
 * itself the base, and CanvasLayer descends from Node (not CanvasItem/Control).
 */
const CONTROL_LEAVES = [
  'Label',
  'RichTextLabel',
  'Button',
  'CheckBox',
  'OptionButton',
  'ColorRect',
  'TextureRect',
  'Panel',
  'PanelContainer',
  'CenterContainer',
  'MarginContainer',
  'ScrollContainer',
  'GridContainer',
  'HBoxContainer',
  'VBoxContainer',
] as const;

export const NODE_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(LIGHT3D_LEAVES.map((t) => [t, 'Light3D'])),
  ...Object.fromEntries(NODE3D_LEAVES.map((t) => [t, 'Node3D'])),
  ...Object.fromEntries(NODE2D_LEAVES.map((t) => [t, 'Node2D'])),
  ...Object.fromEntries(CONTROL_LEAVES.map((t) => [t, 'Control'])),
  // Abstract/non-authorable intermediate classes.
  Light3D: 'Node3D',
  // Base classes and non-spatial nodes collapse to the terminal Node.
  Node3D: 'Node',
  Node2D: 'Node',
  Control: 'Node',
  CanvasLayer: 'Node',
  WorldEnvironment: 'Node',
  AnimationPlayer: 'Node',
  AnimationTree: 'Node',
  AudioStreamPlayer: 'Node',
  Timer: 'Node',
  NavigationAgent3D: 'Node',
});
