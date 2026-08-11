/**
 * A node type must declare validators for its own properties.
 *
 * The coverage ledger counts **parser** registrations, so a slice that parses a
 * type but declares no validators reads as fully covered while
 * `StrictTscnParser` (`if (!validator) return;`) silently accepts every value
 * on it. That is the same silent shape `baseChainCompleteness` exists to
 * prevent, one level down: there the inherited keys go unchecked, here the
 * type's own ones do.
 *
 * It is not hypothetical. This guard was written after finding twenty
 * registered types in exactly that state, among them `Button` (13 own members),
 * `LineEdit` (36) and `RichTextLabel` (30) — all reading green in the ledger.
 *
 * The swept set is the registry PLUS every ancestor reachable from it. The
 * registry alone would be blind to exactly the types that carry the most
 * leverage: Godot's non-instantiable tiers (`Light3D`, `CollisionObject2D/3D`,
 * `Slider`, `Joint2D/3D`, `CanvasItem`, `Viewport`) appear in no `.tscn`, so
 * they register no parser, so a registry-driven sweep can never see one emptied
 * by a refactor. Closing over the base chain reaches them for free and keeps
 * reaching each new tier the day it is scaffolded.
 *
 * Two lists, and the difference between them matters. `NO_OWN_PROPERTIES` is a
 * statement of fact about Godot and is permanent. `UNDECLARED` is a defect
 * list: every entry is a type whose properties are currently unchecked, and it
 * only ever shrinks. A type may join neither by accident.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { baseChain } from './nodeBaseTypes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

/**
 * Types Godot gives no serialisable properties of their own, so declaring none
 * is correct and complete. Verified as `doc/classes/<T>.xml` members without an
 * `overrides=` attribute, cross-checked against `ADD_PROPERTY` in the class's
 * `.cpp` — both zero. These are themed, layout-only or orientation-only
 * refinements of an ancestor, and everything they serialise arrives through the
 * base-walk.
 */
const NO_OWN_PROPERTIES: Readonly<Record<string, string>> = {
  CCDIK3D:
    "a solver body; the class is a `_solve_iteration` override alone, parameterised entirely by IterateIK3D's keys",
  CheckBox: 'a themed BaseButton; its constructor only changes inherited defaults',
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
 * Types with own properties in Godot that this repo has not declared yet. Each
 * is a live gap: those properties are accepted unchecked today.
 *
 * Member counts at the time of writing, for scale rather than as an assertion
 * (nothing can verify them without reading `doc/classes` at test time, which
 * `godot-source-decoupling.test.mjs` forbids). Registered leaves: LineEdit 36,
 * RichTextLabel 30, Label 22, ScrollContainer 11, GridContainer 1. (CanvasLayer
 * declares its own eight now, so it left this list.)
 *
 * The tiers below were invisible until this guard closed over the base chain,
 * and each one is worth more than a leaf because its keys reach every
 * descendant: CSGShape3D 7 (every CSG node), PhysicsBody3D 6 — the axis_lock
 * set, reaching all four 3D bodies — and CSGPrimitive3D 1.
 *
 * `AnimationMixer` left this list once `anims/<name>`, `libraries` and
 * `libraries/<name>` were declared (propertyListRouteCoverage.test.ts) — but
 * that closes only the hand-rolled route. Its TEN `ADD_PROPERTY` members
 * (`active`, `deterministic`, `root_motion_track`, `reset_on_save`,
 * `root_motion_local`, `callback_mode_process`, `callback_mode_method`,
 * `callback_mode_discrete`, `audio_max_polyphony`, `root_node` — all currently
 * declared only on `AnimationTree`, never on `AnimationMixer` itself, so
 * `AnimationPlayer` inherits none of them) are a real, separate, still-open gap
 * this coarser guard can no longer see once ANY own key exists: it counts
 * types with zero own validators, not missing members by name.
 *
 * Removing an entry (by declaring its validators) is the only correct edit.
 */
const UNDECLARED: readonly string[] = ['CSGPrimitive3D', 'CSGShape3D', 'PhysicsBody3D'];

/**
 * Every type this guard holds to account: the registry, closed over the base
 * chain so non-instantiable tiers are included.
 */
function typesUnderGuard(): string[] {
  const all = new Set(nodeRegistry.getAllTypeNames());
  for (const type of [...all]) {
    for (const ancestor of baseChain(type)) all.add(ancestor);
  }
  return [...all].sort();
}

/** Types under guard that declare no validators of their own. */
function typesWithoutOwnValidators(): string[] {
  return typesUnderGuard().filter((type) => validatorRegistry.getOwnKeys(type).length === 0);
}

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
    // Each decrement is a type whose properties stopped being silently accepted.
    expect(UNDECLARED.length).toBeLessThanOrEqual(4);
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
    for (const tier of ['Light3D', 'CollisionObject2D', 'CollisionObject3D', 'Slider']) {
      expect(typesUnderGuard(), `${tier} is not under guard`).toContain(tier);
      expect(validatorRegistry.getOwnKeys(tier), `${tier} declares nothing`).not.toEqual([]);
    }
  });
});
