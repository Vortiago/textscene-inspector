/**
 * Node-type to base-type table for validator inheritance: `ValidatorRegistry.findValidator`
 * walks it so a base's validator set applies to every subclass. A leaf maps straight to
 * its nearest validator-bearing ancestor, and every chain ends at `Node`, which has no
 * entry. Pure data, React- and THREE-free, so it stays on the linter side of the bundle.
 */

/** Light3D-derived concrete nodes, each mapping to `Light3D`, then `Node3D`. */
const LIGHT3D_LEAVES = [
  'DirectionalLight3D',
  'OmniLight3D',
  'SpotLight3D',
  'AreaLight3D',
] as const;

/** Spatial (3D) nodes: Node3D carries the transform and visible set. */
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
  'CSGTorus3D',
  'CSGCombiner3D',
  'CSGMesh3D',
  'CSGPolygon3D',
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
  'VehicleWheel3D',
] as const;

/** Canvas (2D) nodes: Node2D carries the transform and skew set. */
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
  'CanvasModulate',
  'LightOccluder2D',
  'PointLight2D',
  'ParallaxLayer',
  'CPUParticles2D',
] as const;

/**
 * The Control (2D UI) family: Control carries the layout, anchor, offset and
 * theme-override set. `Control` is itself the base, and `CanvasLayer` descends from
 * Node, not CanvasItem, so neither is listed.
 */
const CONTROL_LEAVES = [
  'Label',
  'RichTextLabel',
  'Button',
  'CheckBox',
  'OptionButton',
  'LineEdit',
  // Range → Slider → H/VSlider in Godot, but neither intermediate is
  // authorable and neither carries a validator of its own, so the leaves link
  // straight to Control for the inherited anchor/offset/layout rules.
  'HSlider',
  'VSlider',
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
  // SplitContainer → H/VSplitContainer in Godot; the intermediate is not
  // authorable, so the leaves link straight to Control.
  'HSplitContainer',
  'VSplitContainer',
  // Displays its SubViewport children's targets (ADR-0033). Without the Control
  // chain, every anchor, offset and layout validator would skip it.
  'SubViewportContainer',
] as const;

export const NODE_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(LIGHT3D_LEAVES.map((t) => [t, 'Light3D'])),
  ...Object.fromEntries(NODE3D_LEAVES.map((t) => [t, 'Node3D'])),
  ...Object.fromEntries(NODE2D_LEAVES.map((t) => [t, 'Node2D'])),
  ...Object.fromEntries(CONTROL_LEAVES.map((t) => [t, 'Control'])),
  // Abstract/non-authorable intermediate classes.
  Light3D: 'Node3D',
  // VehicleBody3D really is a RigidBody3D subclass, and scenes author the
  // inherited mass / physics_material_override / center_of_mass_mode on it.
  // Chaining through RigidBody3D (itself a NODE3D_LEAF) inherits that whole
  // validator set instead of duplicating it here.
  VehicleBody3D: 'RigidBody3D',
  // SubViewport < Viewport < Node. `Viewport` is not modelled as its own link
  // because SubViewport is the only authorable subclass supported here (`Window`
  // is not), so its Viewport-level properties are validated on the leaf itself.
  SubViewport: 'Node',
  // Base classes and non-spatial nodes collapse to the terminal Node.
  Node3D: 'Node',
  Node2D: 'Node',
  Control: 'Node',
  CanvasLayer: 'Node',
  // A CanvasLayer, not a CanvasItem: `GDCLASS(ParallaxBackground, CanvasLayer)`.
  // Chaining it here is what gives it CanvasLayer's `layer`/`visible` rules
  // rather than Node2D's transform ones.
  ParallaxBackground: 'CanvasLayer',
  WorldEnvironment: 'Node',
  AnimationPlayer: 'Node',
  AnimationTree: 'Node',
  AudioStreamPlayer: 'Node',
  Timer: 'Node',
  NavigationAgent3D: 'Node',
});
