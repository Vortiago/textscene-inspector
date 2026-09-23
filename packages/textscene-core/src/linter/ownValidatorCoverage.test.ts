/**
 * A node type must declare validators for its own properties: the coverage ledger
 * counts parser registrations, while `StrictTscnParser` (`if (!validator) return;`)
 * accepts every value on a type with none. `NO_OWN_PROPERTIES` is a permanent fact
 * about Godot, and `UNDECLARED` is a defect list that only shrinks.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { baseChain, MAX_BASE_CHAIN_HOPS } from '../godot/nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from '../godot/resourceBaseTypes.generated.js';
import { resourceSliceRegistry } from '../resources/sliceRegistration.js';
import '../resources/sliceRegistrations.js'; // side-effect: every resource slice claims its types
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

/**
 * Types Godot gives no serialisable properties of their own: `doc/classes/<T>.xml` lists
 * no member without `overrides=`, and the class's `.cpp` has no `ADD_PROPERTY`. Each is a
 * themed, layout-only or orientation-only refinement of an ancestor, and everything it
 * serialises arrives through the base-walk.
 */
const NO_OWN_PROPERTIES: Readonly<Record<string, string>> = {
  CCDIK3D:
    "a solver body; the class is a `_solve_iteration` override alone, parameterised entirely by IterateIK3D's keys",
  CheckBox: 'a themed BaseButton; its constructor only changes inherited defaults',
  CSGCombiner3D:
    'a CSGShape3D whose whole class body is `_build_brush` and a constructor (csg_shape.h:194-202, csg_shape.cpp:1072-1077); no _bind_methods, so operation and the collision keys are CSGShape3D\'s',
  CheckButton: 'a themed BaseButton; its constructor only changes inherited defaults',
  Container: 'layout behaviour only, driven entirely by Control keys',
  FABRIK3D:
    "a solver body; the class is a `_solve_iteration` override alone, parameterised entirely by IterateIK3D's keys",
  HBoxContainer: "orientation only; the box keys are BoxContainer's",
  HFlowContainer: "orientation only; the flow keys are FlowContainer's",
  HScrollBar: "orientation only; the scrollbar keys are ScrollBar's",
  HSeparator: 'a themed Separator; its constructor only sets a protected orientation field, not a property',
  HSlider: "orientation only; the slider keys are Slider's",
  HSplitContainer: "orientation only; the split keys are SplitContainer's",
  JacobianIK3D:
    "a solver body; the class is a `_solve_iteration` override alone, parameterised entirely by IterateIK3D's keys",
  LightmapProbe:
    'a bare position marker: lightmap_probe.h:35-39 is the whole class body and declares no _bind_methods, so GDCLASS never binds one (object.h:526) and no ADD_PROPERTY can exist; LightmapGI reads only its inherited get_global_transform()',
  OpenXRVisibilityMask:
    'its _bind_methods body is empty (openxr_visibility_mask.cpp:37-38) and the class declares no property-list override in either spelling; the mask mesh comes from the OpenXR runtime extension, so nothing about it reaches a .tscn',
  SpringBoneCollisionPlane3D:
    'an infinite XZ plane whose normal is +Y through the base offsets, so it needs no extent of its own; the class is a _collide override alone (spring_bone_collision_plane_3d.cpp:31-43) with no _bind_methods under any spelling, which GDCLASS then skips binding (object.h:526), and its XML lists no members',
  PhysicalBoneSimulator3D:
    "drives its PhysicalBone3D children, which hold every simulation parameter; _bind_methods binds five methods and zero ADD_PROPERTY (physical_bone_simulator_3d.cpp:386-393), and it overrides no property-list hook under either spelling",
  MarginContainer: 'margins are theme constants, not properties',
  OpenXRBindingModifierEditor:
    'editor-only PanelContainer; its constructor only changes the inherited size_flags_horizontal default',
  OpenXRInteractionProfileEditor:
    'editor-only (TOOLS_ENABLED); _bind_methods binds methods only, and its abstract base declares nothing either',
  PopupPanel: 'a themed Popup; its panel stylebox is a ThemeDB binding, not an ADD_PROPERTY',
  Separator:
    'abstract separator base; binds zero ADD_PROPERTY, only the separation constant and separator StyleBox as theme items (separator.cpp:61-62)',
  ScriptCreateDialog:
    'editor-only (TOOLS_ENABLED); binds no ADD_PROPERTY and overrides no _get_property_list, so its 3 documented members are all overrides= default changes',
  OpenXRInteractionProfileEditorBase:
    'abstract editor tier Godot cannot instantiate; binds no ADD_PROPERTY, so it owns no key to validate',
  Panel: 'draws only its theme stylebox',
  PanelContainer: 'draws only its theme stylebox',
  PhysicsBody2D: 'its one member, input_pickable, is overrides=CollisionObject2D',
  Popup: "popup behaviour only; the geometry keys are Window's",
  VBoxContainer: "orientation only; the box keys are BoxContainer's",
  VFlowContainer: "orientation only; the flow keys are FlowContainer's",
  VScrollBar: "orientation only; the scrollbar keys are ScrollBar's",
  VSeparator: 'a themed Separator; its constructor only sets a protected orientation field, not a property',
  VSlider: "orientation only; the slider keys are Slider's",
  VSplitContainer: "orientation only; the split keys are SplitContainer's",
  XRCamera3D:
    'the headset drives its transform, so it declares nothing of its own: xr_nodes.cpp has no XRCamera3D::_bind_methods at all, and its single XML member is physics_interpolation_mode carrying overrides=Node. Its _validate_property (xr_nodes.cpp:39-47) only sets PROPERTY_USAGE_NO_EDITOR on five inherited Camera3D keys, and only under is_editor_hint(), so those keys still serialise and Camera3D still validates them',
  XRAnchor3D:
    'a tracked-anchor transform relay: _bind_methods (xr_nodes.cpp:660-663) binds get_size and get_plane as METHODS and nothing else, with no ADD_PROPERTY and no property-list override under either spelling, and its XML carries no members block. Everything it serialises is XRNode3D\'s',
  XRController3D:
    'a tracked-controller input reader: _bind_methods (xr_nodes.cpp:524-538) binds is_button_pressed/get_input/get_float/get_vector2/get_tracker_hand as METHODS plus four signals, with no ADD_PROPERTY and no property-list override under either spelling. Its XML carries no members block, and everything it serialises is XRNode3D\'s',
  OpenXRRenderModel:
    'its one member, render_model (openxr_render_model.cpp:46), is a Variant::RID. RID is not excluded by grammar — VariantWriter::write puts it in the ordinary misc-types branch (variant_parser.cpp:2157-2163), not the SIGNAL/CALLABLE "do not really store" bucket, and its usage carries STORAGE. What rules it out is ownership: the only path that sets a non-default value is OpenXRRenderModelManager::_update_models (openxr_render_model_manager.cpp:93-96), which memnew/add_child()es these nodes without ever calling set_owner(), so packed_scene.cpp:797 discards them before any save. A hand-placed node keeps the RID() default, and only non-default values are written',
};

/**
 * Types with own properties in Godot that are not declared yet, each a live gap. Empty,
 * but kept as the ratchet: adding a type means raising the pinned count below, and
 * declaring its validators is the only correct removal.
 */
const UNDECLARED: readonly string[] = [];

/**
 * Every type this guard holds to account: the registry, closed over the base chain,
 * so it reaches the non-instantiable tiers (`Light3D`, `CollisionObject2D/3D`, `Slider`,
 * `CanvasItem`) that appear in no `.tscn` and register no parser.
 */
function typesUnderGuard(): string[] {
  const all = new Set(nodeRegistry.getAllTypeNames());
  for (const type of [...all]) {
    for (const ancestor of baseChain(type)) all.add(ancestor);
  }
  return [...all].sort();
}

/**
 * Types under guard with no own validators. It counts types, not missing members:
 * `AnimationMixer`'s `ADD_PROPERTY` members (`active`, `deterministic`, `root_motion_track`,
 * `reset_on_save`, `root_motion_local`, `callback_mode_*`, `audio_max_polyphony`, `root_node`)
 * are declared only on `AnimationTree`, so `AnimationPlayer` inherits none, unseen here.
 */
function typesWithoutOwnValidators(): string[] {
  return typesUnderGuard().filter((type) => validatorRegistry.getOwnKeys(type).length === 0);
}

/**
 * Claimed resource classes with no own validators, a ratchet of its own since the node
 * base chain never reaches a Resource (`box_shape_3d.cpp:100` refuses a negative size).
 * Pseudo-types outside ClassDB (`GLB`, `GLTF`) are excluded. Declaring its validators is
 * the only correct removal.
 */
const UNDECLARED_RESOURCES: readonly string[] = [
  'ArrayMesh', 'AtlasTexture', 'BoxMesh', 'BoxShape3D', 'CanvasItemMaterial', 'CapsuleMesh',
  'CompressedTexture2D',
  'ConcavePolygonShape3D', 'ConvexPolygonShape3D', 'Curve', 'Curve2D', 'Curve3D', 'CylinderMesh',
  'FastNoiseLite', 'Gradient', 'GradientTexture2D', 'ImageTexture',
  'NavigationMesh', 'NavigationPolygon',
  // `Noise` and `Texture` are abstract tiers with zero `ADD_PROPERTY` calls in
  // 4.6.3, so there is nothing of their own to validate; they are listed to
  // record that, not as work.
  'Noise', 'NoiseTexture2D', 'PackedScene', 'PanoramaSkyMaterial',
  'PhysicalSkyMaterial', 'PrismMesh', 'ProceduralSkyMaterial', 'QuadMesh', 'RectangleShape2D',
  'ShaderMaterial', 'Sky', 'SphereMesh', 'SpriteFrames', 'StandardMaterial3D',
  'StyleBoxEmpty', 'StyleBoxFlat', 'Texture', 'Texture2D', 'TorusMesh', 'ViewportTexture',
  // The font and theme slices decode enough to draw (a `.tres` wrapper's fallbacks,
  // a variation's base font, a theme's type chain) and validate none of it. `Font`
  // is the abstract tier the other three descend from.
  'Font', 'FontFile', 'FontVariation', 'SystemFont', 'Theme',
  // The highlighter and label-settings slices decode enough to draw and validate
  // none of it. `SyntaxHighlighter`, the abstract tier `CodeHighlighter` descends
  // from, declares zero `ADD_PROPERTY` of its own in 4.6.3: listed as a record.
  'CodeHighlighter', 'LabelSettings', 'SyntaxHighlighter',
];

/**
 * Claimed resource types Godot's ClassDB also declares, closed over the resource base
 * chain like the node half. No slice claims an abstract tier, so without the closure
 * `BaseMaterial3D`, `PrimitiveMesh`, `Material`, `Shape2D`, `Shape3D` or `Mesh` could
 * empty while `unaccounted` and `stale` both read `[]`.
 */
function claimedResourceClasses(): string[] {
  const claimed = new Set(resourceSliceRegistry.all().flatMap((r) => r.typeNames));
  for (const type of [...claimed]) {
    let current: string | undefined = type;
    for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
      claimed.add(current);
      current = RESOURCE_BASE_TYPES_GENERATED[current];
    }
  }
  return [...claimed]
    .filter((type) => type === 'Resource' || type in RESOURCE_BASE_TYPES_GENERATED)
    .sort();
}

describe('own-validator coverage for resource slices', () => {
  it('accounts for every claimed resource type that declares no validators', () => {
    const accounted = new Set(UNDECLARED_RESOURCES);
    const unaccounted = claimedResourceClasses()
      .filter((type) => validatorRegistry.getOwnKeys(type).length === 0)
      .filter((type) => !accounted.has(type));

    // A type here parses but validates nothing of its own, so every property on
    // it is silently accepted. Declare its validators.
    expect(unaccounted).toEqual([]);
  });

  it('keeps the list free of types that now declare validators', () => {
    const stale = UNDECLARED_RESOURCES.filter(
      (type) => validatorRegistry.getOwnKeys(type).length > 0
    );
    expect(stale).toEqual([]);
  });

  it('never lets the undeclared resource list grow', () => {
    // The ratchet, exact rather than a ceiling: a ceiling above the current length is
    // a free slot for the next unvalidated slice. Raising it records slices that draw
    // without validating, and the only correct edit afterwards is lowering it.
    expect(UNDECLARED_RESOURCES.length).toBe(47);
  });

  it('sweeps a population that cannot quietly empty', () => {
    // A claim table that stopped populating would make every assertion above
    // trivially green.
    expect(claimedResourceClasses().length).toBeGreaterThan(40);
  });
});

describe('own-validator coverage', () => {
  it('accounts for every type that declares no validators', () => {
    const accounted = new Set([...Object.keys(NO_OWN_PROPERTIES), ...UNDECLARED]);
    const unaccounted = typesWithoutOwnValidators().filter((type) => !accounted.has(type));

    // A type here parses but validates nothing of its own. Declare its
    // validators, or add it to NO_OWN_PROPERTIES if Godot truly gives it none.
    expect(unaccounted).toEqual([]);
  });

  it('keeps both lists free of types that now declare validators', () => {
    const stale = [...Object.keys(NO_OWN_PROPERTIES), ...UNDECLARED].filter(
      (type) => validatorRegistry.getOwnKeys(type).length > 0
    );

    // Stale entries make the gap look larger than it is and hide regressions.
    expect(stale).toEqual([]);
  });

  it('never lets the undeclared list grow', () => {
    // The ratchet: a new gap cannot be waved through by appending to the list.
    // Exact equality, not a ceiling: a ceiling above the current length is a free
    // slot for an appended gap that moves no constant.
    expect(UNDECLARED.length).toBe(0);
  });

  it('declares validators for Button, whose 13 members were the trigger', () => {
    // The only place the exact count is pinned; button/linterParser.test.ts
    // asserts non-empty but not how many.
    expect(validatorRegistry.getOwnKeys('Button')).toHaveLength(13);
  });

  it('reaches the non-instantiable tiers, which register no parser', () => {
    // The whole point of closing over the base chain. These appear in no
    // `.tscn` and so in no registry; without the closure an emptied tier would
    // pass this guard silently.
    for (const tier of [
      'Light3D',
      'CollisionObject2D',
      'CollisionObject3D',
      'PhysicsBody3D',
      'CSGShape3D',
      'CSGPrimitive3D',
      'Slider',
    ]) {
      expect(typesUnderGuard(), `${tier} is not under guard`).toContain(tier);
      expect(validatorRegistry.getOwnKeys(tier), `${tier} declares nothing`).not.toEqual([]);
    }
  });
});
