/**
 * Canonical node-type → base-type table for the linter's validator inheritance.
 * `ValidatorRegistry.findValidator` walks this chain so the Node3D /
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

/**
 * GeometryInstance3D-derived nodes — everything that draws real geometry. They
 * inherit the shadow / LOD / GI / visibility-range set from
 * `GeometryInstance3D`, then render layers from `VisualInstance3D`, then the
 * transform from `Node3D`.
 */
const GEOMETRYINSTANCE3D_LEAVES = [
  'MeshInstance3D',
  'Sprite3D',
  'Label3D',
  'GPUParticles3D',
  'CSGBox3D',
  'CSGCylinder3D',
  'CSGSphere3D',
  'CSGTorus3D',
  'CSGCombiner3D',
  'CSGMesh3D',
  'CSGPolygon3D',
] as const;

/**
 * VisualInstance3D-derived nodes that are NOT GeometryInstance3D. `Decal` is
 * the only registered one — Godot's chain for it has no GeometryInstance3D hop,
 * so it takes render layers and skips the geometry set.
 */
const VISUALINSTANCE3D_LEAVES = [
  'Decal',
  'VisibleOnScreenNotifier3D',
] as const;

/** Base for every spatial (3D) node — Node3D carries the transform/visible set. */
const NODE3D_LEAVES = [
  'Camera3D',
  'GridMap',
  'Skeleton3D',
  'Marker3D',
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
  'SkeletonModifier3D',
  'SpringBoneCollision3D',
  'XRNode3D',
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
  'CanvasModulate',
  'LightOccluder2D',
  'PointLight2D',
  'ParallaxLayer',
  'CPUParticles2D',
  'VisibleOnScreenNotifier2D',
] as const;

/**
 * The fixed-orientation container leaves. Each inherits its base's layout set
 * and then narrows one key: `vertical` is rejected on them, because the class
 * fixes the orientation and Godot refuses the assignment (see
 * nodes/2d/ui/shared/fixedOrientation.ts).
 */
const BOXCONTAINER_LEAVES = ['HBoxContainer', 'VBoxContainer'] as const;
const SPLITCONTAINER_LEAVES = ['HSplitContainer', 'VSplitContainer'] as const;

/**
 * Range-derived nodes — they inherit min/max/step/page/value from `Range`, then
 * the anchor/offset/theme set from `Control`.
 *
 * Godot puts `Slider` between the two sliders and `Range`; `Slider` is not
 * instantiable and registers nothing, so the chain flattens past it.
 * `baseChainCompleteness.test.ts` fails the day that stops being true.
 */
const RANGE_LEAVES = [
  'HSlider',
  'VSlider',
] as const;

/**
 * BaseButton-derived nodes — they inherit the pressed/toggle/shortcut set from
 * `BaseButton`, then the anchor/offset/theme set from `Control`.
 *
 * Godot puts `Button` between `CheckBox`/`OptionButton` and `BaseButton`, but
 * `Button` registers no validators of its own, so the chain flattens past it.
 * `baseChainCompleteness.test.ts` fails the day that stops being true.
 */
const BASEBUTTON_LEAVES = [
  'Button',
  'CheckBox',
  'OptionButton',
] as const;

/**
 * Base for the Control (2D UI) family — Control carries the layout/anchor/offset
 * + theme-override set. `Control` and `CanvasLayer` are NOT in here: Control is
 * itself the base, and CanvasLayer descends from Node (not CanvasItem/Control).
 */
const CONTROL_LEAVES = [
  'Label',
  'RichTextLabel',
  'LineEdit',
  'ColorRect',
  'TextureRect',
  'Panel',
  'PanelContainer',
  'CenterContainer',
  'MarginContainer',
  'ScrollContainer',
  'GridContainer',
  // Displays its SubViewport children's targets (ADR-0030). Needs the Control
  // chain like any other: without it every anchor/offset/layout validator
  // silently skips this type while erroring on every sibling Control.
  'SubViewportContainer',
  'BaseButton',
  'Container',
  'Range',
  'TextEdit',
] as const;

export const NODE_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(LIGHT3D_LEAVES.map((t) => [t, 'Light3D'])),
  ...Object.fromEntries(GEOMETRYINSTANCE3D_LEAVES.map((t) => [t, 'GeometryInstance3D'])),
  ...Object.fromEntries(VISUALINSTANCE3D_LEAVES.map((t) => [t, 'VisualInstance3D'])),
  ...Object.fromEntries(NODE3D_LEAVES.map((t) => [t, 'Node3D'])),
  ...Object.fromEntries(NODE2D_LEAVES.map((t) => [t, 'Node2D'])),
  ...Object.fromEntries(BOXCONTAINER_LEAVES.map((t) => [t, 'BoxContainer'])),
  ...Object.fromEntries(SPLITCONTAINER_LEAVES.map((t) => [t, 'SplitContainer'])),
  ...Object.fromEntries(RANGE_LEAVES.map((t) => [t, 'Range'])),
  ...Object.fromEntries(BASEBUTTON_LEAVES.map((t) => [t, 'BaseButton'])),
  ...Object.fromEntries(CONTROL_LEAVES.map((t) => [t, 'Control'])),
  // Abstract/non-authorable intermediate classes.
  // Light3D < VisualInstance3D in Godot, and VisualInstance3D validates the
  // render `layers` every light also carries.
  Light3D: 'VisualInstance3D',
  GeometryInstance3D: 'VisualInstance3D',
  BaseButton: 'Control',
  SplitContainer: 'Container',
  Range: 'Control',
  TextEdit: 'Control',
  VisualInstance3D: 'Node3D',
  // SubViewport and Window are Godot's two instantiable Viewports. `Viewport`
  // itself is not instantiable, so like Light3D it carries validators without
  // owning a slice — see nodes/viewport/shared/linterParser.ts.
  Viewport: 'Node',
  SubViewport: 'Viewport',
  Window: 'Viewport',
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
  AcceptDialog: 'Window',
  BoneConstraint3D: 'SkeletonModifier3D',
  Popup: 'Window',
  BoxContainer: 'Container',
  FlowContainer: 'Container',
  GraphElement: 'Container',
  ConfirmationDialog: 'AcceptDialog',
});
