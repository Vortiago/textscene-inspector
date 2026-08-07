/**
 * `ADD_PROPERTY` is one of four ways a property reaches a `.tscn`. The other
 * three are `PropertyListHelper`/`register_property`, `ADD_ARRAY_COUNT`, and a
 * hand-rolled `_set`/`_get`/property-list override — which is NOT always
 * underscore-prefixed (`ChainIK3D::get_property_list` has none, and that class
 * serialises a whole nested `settings/<i>/joints/<j>/` family while declaring
 * zero `ADD_PROPERTY` and zero XML `<member>`).
 *
 * `baseChainCompleteness`/`ownValidatorCoverage` sweep every DECLARED property.
 * A key that arrives through one of these other three routes was never
 * declared anywhere a sweep over `ADD_PROPERTY`/XML could find it, so a type
 * can carry a whole family of them and still read as fully covered while
 * `StrictTscnParser` (`if (!validator) return;`) silently accepts every value
 * on that family. That is the gap this file closes: 38 classes, each
 * confirmed by reading its override to genuinely introduce a key none of the
 * other guards would ever see.
 *
 * `MultiplayerSpawner` is the one class this population excludes: its
 * `scenes/<i>/…` pushes carry `PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_ARRAY`
 * with no storage bit (`multiplayer_spawner.cpp:72,83`), and
 * `SceneState::save` skips any property lacking `PROPERTY_USAGE_STORAGE`
 * (`packed_scene.cpp:865-867`), so that family never reaches a `.tscn` at all.
 *
 * Two facts govern most `validated`/`unimplemented` calls below.
 * `PROPERTY_USAGE_NO_EDITOR` equals `PROPERTY_USAGE_STORAGE` alone
 * (`object.h:132`): it hides a key from the inspector and nothing more, so
 * such a key IS serialised. `PROPERTY_USAGE_DEFAULT` is `STORAGE | EDITOR`
 * (`object.h:131`), and a `PropertyInfo` built with no usage argument at all
 * defaults to it. Only an EXPLICIT usage list that omits the storage bit
 * excludes a key, and several classes below mix both shapes across keys of
 * the SAME function.
 *
 * `sample` is a concrete key exactly as it would land in a `.tscn`, chosen so
 * `validatorRegistry.findValidator` can be called on it directly. For a
 * `validated` row that proves the family resolves on every concrete
 * registered type descending from the declaring class (the base-walk
 * mechanism `settingsFamilySeam.test.ts` exercises in depth for the two
 * `settings/` seam owners, `ChainIK3D` and `BoneConstraint3D` — this file does
 * not re-assert the SHADOW/delegation contract that file already covers, only
 * that a validator resolves at all). For an `unimplemented` row the same call
 * is asserted to still be `null`, so fixing the gap requires editing this
 * table rather than leaving a stale row behind.
 *
 * `UNIMPLEMENTED_COUNT` is a ratchet, exactly like `ownValidatorCoverage`'s
 * `UNDECLARED`: the ceiling can only move down, and every row it counts is a
 * live property family a scene author can write today with zero validation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { descendsFrom } from './nodeBaseTypes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

interface RouteRow {
  /** The Godot class whose override introduces this family. */
  readonly type: string;
  /** The override that builds the family, `file.cpp:line`, basename only. */
  readonly at: string;
  /** How the key is built. */
  readonly route: 'property-list' | 'PropertyListHelper' | 'ADD_ARRAY_COUNT' | 'set-get';
  /** A concrete key of this family, exactly as it lands in a `.tscn`. */
  readonly sample: string;
  readonly verdict:
    | { readonly validated: true }
    | {
        readonly declined: 'no-storage-bit' | 'never-owned' | 'runtime-shaped';
        readonly because: string;
      }
    | { readonly unimplemented: string };
}

const ROWS: readonly RouteRow[] = [
  // --- Skeleton modifier tree: settings/ and chains/ hand-rolled families ---
  // All eleven already validated; settingsFamilySeam.test.ts separately proves
  // the ChainIK3D/BoneConstraint3D SHADOW+delegation contract these dispatchers
  // depend on, so this file only re-confirms each family resolves.
  {
    type: 'AimModifier3D',
    at: 'aim_modifier_3d.cpp:84-97',
    route: 'property-list',
    sample: 'settings/0/forward_axis',
    verdict: { validated: true },
  },
  {
    type: 'BoneConstraint3D',
    at: 'bone_constraint_3d.cpp:91-115',
    route: 'property-list',
    sample: 'settings/0/amount',
    verdict: { validated: true },
  },
  {
    type: 'BoneTwistDisperser3D',
    at: 'bone_twist_disperser_3d.cpp:133-165',
    route: 'property-list',
    sample: 'settings/0/joints/0/twist_amount',
    verdict: { validated: true },
  },
  {
    type: 'ChainIK3D',
    at: 'chain_ik_3d.cpp:115-138',
    route: 'property-list',
    sample: 'settings/0/root_bone_name',
    verdict: { validated: true },
  },
  {
    type: 'ConvertTransformModifier3D',
    at: 'convert_transform_modifier_3d.cpp:125-167',
    route: 'property-list',
    sample: 'settings/0/apply/transform_mode',
    verdict: { validated: true },
  },
  {
    type: 'CopyTransformModifier3D',
    at: 'copy_transform_modifier_3d.cpp:83-101',
    route: 'property-list',
    sample: 'settings/0/copy',
    verdict: { validated: true },
  },
  {
    type: 'IterateIK3D',
    at: 'iterate_ik_3d.cpp:113-134',
    route: 'property-list',
    sample: 'settings/0/target_node',
    verdict: { validated: true },
  },
  {
    type: 'LimitAngularVelocityModifier3D',
    at: 'limit_angular_velocity_modifier_3d.cpp:90-104',
    route: 'property-list',
    sample: 'chains/0/root_bone_name',
    verdict: { validated: true },
  },
  {
    // Same override as the row above; a distinct family (no storage on
    // Godot's own writes) with its own dispatcher and its own row.
    type: 'LimitAngularVelocityModifier3D',
    at: 'limit_angular_velocity_modifier_3d.cpp:105-108',
    route: 'property-list',
    sample: 'joints/0/bone_name',
    verdict: { validated: true },
  },
  {
    type: 'SplineIK3D',
    at: 'spline_ik_3d.cpp:79-95',
    route: 'property-list',
    sample: 'settings/0/path_3d',
    verdict: { validated: true },
  },
  {
    type: 'SpringBoneSimulator3D',
    at: 'spring_bone_simulator_3d.cpp:282-339',
    route: 'property-list',
    sample: 'settings/0/radius/value',
    verdict: { validated: true },
  },
  {
    type: 'TwoBoneIK3D',
    at: 'two_bone_ik_3d.cpp:129-160',
    route: 'property-list',
    sample: 'settings/0/target_node',
    verdict: { validated: true },
  },

  // --- Animation: legacy compat keys and a fully dynamic parameter tree ---
  {
    // #ifndef DISABLE_DEPRECATED (on by default). Never enumerated by
    // _get_property_list, so a 3.x scene's `anims/Walk = SubResource(...)` is
    // read by _set alone (animation_mixer.cpp:58-71) and reaches no validator:
    // AnimationMixer has no linterParser.ts slice of its own at all.
    type: 'AnimationMixer',
    at: 'animation_mixer.cpp:58-71',
    route: 'set-get',
    sample: 'anims/Walk',
    verdict: {
      unimplemented:
        'legacy per-animation compat key with no PropertyInfo of its own; needs a resourceReference-shaped check, matching libraries/<name> below',
    },
  },
  {
    // Bare "libraries" replaces the whole AnimationLibrary set as one
    // Dictionary (animation_mixer.cpp:72-81), also DISABLE_DEPRECATED-gated.
    type: 'AnimationMixer',
    at: 'animation_mixer.cpp:72-81',
    route: 'set-get',
    sample: 'libraries',
    verdict: {
      unimplemented:
        'legacy whole-Dictionary compat key with no PropertyInfo; needs at minimum a Dictionary-shape format check',
    },
  },
  {
    // _get_libraries_property_usage() (animation_mixer.cpp:125-127) returns
    // PROPERTY_USAGE_STORAGE unconditionally on AnimationMixer, so every
    // library is always serialised.
    type: 'AnimationMixer',
    at: 'animation_mixer.cpp:129-134',
    route: 'property-list',
    sample: 'libraries/Main',
    verdict: {
      unimplemented:
        'AnimationLibrary resource reference per library name; needs a resourceReference validator like surface_material_override/* has',
    },
  },
  {
    // "For backward compatibility." (animation_player.cpp:38-39,71-73). Never
    // pushed by _get_property_list, so only a hand-edited/legacy scene's
    // playback/play key ever reaches _set.
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:38-39',
    route: 'set-get',
    sample: 'playback/play',
    verdict: {
      unimplemented:
        'backward-compat alias for current_animation; needs the same quotedString check current_animation already has',
    },
  },
  {
    // Conditionally pushed: only for an animation with a "next" override set
    // (animation_player.cpp:130-138). Usage NO_EDITOR|INTERNAL still carries
    // storage (object.h:132).
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:130-138',
    route: 'property-list',
    sample: 'next/Attack',
    verdict: {
      unimplemented: 'per-animation "next" override, an animation name; needs a quotedString check',
    },
  },
  {
    // Flat Array of (from, to, time) triples. ERR_FAIL_COND_V(len % 3, false)
    // (animation_player.cpp:46) is a real enforced whole-value bound: a
    // malformed length is refused outright, not merely hinted.
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:144',
    route: 'property-list',
    sample: 'blend_times',
    verdict: {
      unimplemented:
        'flat Array of (from, to, time) triples; ERR_FAIL_COND_V(len % 3) at animation_player.cpp:46 is an enforced bound nothing here checks',
    },
  },
  {
    // method_call_mode / playback_process_mode / playback_active — three
    // #ifndef DISABLE_DEPRECATED aliases (animation_player.cpp:54-61,93-100),
    // ALL already registered.
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:54-61',
    route: 'set-get',
    sample: 'playback_active',
    verdict: { validated: true },
  },
  {
    type: 'AnimationTree',
    at: 'animation_tree.cpp:924-929',
    route: 'set-get',
    sample: 'process_callback',
    verdict: { validated: true },
  },
  {
    // Built recursively from each AnimationNode's own get_parameter_list
    // (animation_tree.cpp:767-829), so the PropertyInfo for a given leaf comes
    // from a different C++ class per graph shape — genuinely dynamic, but the
    // KEY PREFIX ("parameters/") is fixed, same shape as ShaderGlobalsOverride's
    // params/*, which already has a deliberately permissive validator.
    type: 'AnimationTree',
    at: 'animation_tree.cpp:969-977',
    route: 'property-list',
    sample: 'parameters/conditions/idle',
    verdict: {
      unimplemented:
        'per-AnimationNode dynamic parameter tree; type/hint vary by node (StateMachine/BlendTree/Animation/…), so at minimum a permissive validator like params/* is missing',
    },
  },

  // --- 2D transform-adjacent hand-rolled keys ---
  {
    type: 'AudioListener2D',
    at: 'audio_listener_2d.cpp:61-63',
    route: 'property-list',
    sample: 'current',
    verdict: { validated: true },
  },
  {
    type: 'AudioListener3D',
    at: 'audio_listener_3d.cpp:70-72',
    route: 'property-list',
    sample: 'current',
    verdict: { validated: true },
  },
  {
    // auto_calculate_length_and_angle, length, bone_angle and (TOOLS_ENABLED)
    // editor_settings/show_bone_gizmo, all pushed at skeleton_2d.cpp:86-94 and
    // all already registered.
    type: 'Bone2D',
    at: 'skeleton_2d.cpp:85-95',
    route: 'property-list',
    sample: 'length',
    verdict: { validated: true },
  },
  {
    // set_length alias with no PropertyInfo (skeleton_2d.cpp:48-49,70-71);
    // never appears in _get_property_list, so only a hand-edited/legacy scene
    // reaches it.
    type: 'Bone2D',
    at: 'skeleton_2d.cpp:48-49',
    route: 'set-get',
    sample: 'default_length',
    verdict: {
      unimplemented: 'legacy alias for length with no PropertyInfo; needs the same float check length has',
    },
  },
  {
    type: 'Skeleton2D',
    at: 'skeleton_2d.cpp:530-536',
    route: 'property-list',
    sample: 'modification_stack',
    verdict: { validated: true },
  },

  // --- 3D skeleton/physics/tile data ---
  {
    // bones/<i>/{name,parent,rest,enabled,position,rotation,scale}, all
    // unconditionally NO_EDITOR (storage-bearing). bone_meta/<name> is a
    // NESTED leaf under the same bones/<i>/ prefix (skeleton_3d.cpp:203-206),
    // not a separate top-level family, so it resolves through the same
    // registered 'bones/*' wildcard.
    type: 'Skeleton3D',
    at: 'skeleton_3d.cpp:182-208',
    route: 'property-list',
    sample: 'bones/0/position',
    verdict: { validated: true },
  },
  {
    type: 'PhysicalBone3D',
    at: 'physical_bone_3d.cpp:740-751',
    route: 'property-list',
    sample: 'bone_name',
    verdict: { validated: true },
  },
  {
    // Delegated to whichever JointData subclass owns the live joint_type
    // (physical_bone_3d.cpp:748-750); e.g. SixDOFJointData's own
    // _get_property_list (physical_bone_3d.cpp:681 onward) for the per-axis leaves.
    type: 'PhysicalBone3D',
    at: 'physical_bone_3d.cpp:748-750',
    route: 'property-list',
    sample: 'joint_constraints/x/angular_limit_enabled',
    verdict: { validated: true },
  },
  {
    // Flat PACKED_INT32_ARRAY, no usage argument (soft_body_3d.cpp:176) so it
    // is PROPERTY_USAGE_DEFAULT (storage). _set_property_pinned_points_indices
    // resizes/pins with no clamp on the indices themselves.
    type: 'SoftBody3D',
    at: 'soft_body_3d.cpp:176',
    route: 'property-list',
    sample: 'pinned_points',
    verdict: {
      unimplemented: 'PackedInt32Array of point indices; no clamp in the setter, so at minimum a format check is missing',
    },
  },
  {
    // point_index/spatial_attachment_path/offset per pinned point
    // (soft_body_3d.cpp:178-183). point_index writes are silently dropped:
    // _set_property_pinned_points_attachment has no branch for it and falls to
    // `return false` (soft_body_3d.cpp:238-239) even though the key carries
    // storage and is read back — the same "setter refuses" shape ChainIK3D's
    // joints/<j>/bone already has a readOnly-style validator for.
    type: 'SoftBody3D',
    at: 'soft_body_3d.cpp:178-183',
    route: 'property-list',
    sample: 'attachments/0/spatial_attachment_path',
    verdict: {
      unimplemented:
        'NodePath/Vector3 per pinned point; point_index is pushed with storage but the setter has no case for it (soft_body_3d.cpp:238-239) and drops the write, deserving a readOnly-style rejection like ChainIK3D\'s joints family',
    },
  },
  {
    // Packed cell dictionary: 2 ints key + 1 int cell value per entry.
    // ERR_FAIL_COND_V(amount % 3, false) (grid_map.cpp, inside the "data"
    // branch) is a real enforced whole-value bound.
    type: 'GridMap',
    at: 'grid_map.cpp:158',
    route: 'property-list',
    sample: 'data',
    verdict: {
      unimplemented:
        "packed cell Dictionary (2-int key + 1-int cell per entry); the setter's ERR_FAIL_COND_V(amount % 3) is an enforced bound nothing here checks",
    },
  },
  {
    // Conditionally pushed only when baked_meshes.size() > 0 (grid_map.cpp:154-156).
    type: 'GridMap',
    at: 'grid_map.cpp:154-156',
    route: 'property-list',
    sample: 'baked_meshes',
    verdict: {
      unimplemented:
        'Array of baked ArrayMesh resources; a null mesh is silently dropped per-element (ERR_CONTINUE), unchecked here',
    },
  },
  {
    // Seven PropertyListHelper leaves per TileMapLayer (name, enabled,
    // modulate, y_sort_enabled, y_sort_origin, z_index, navigation_enabled)
    // plus tile_data, registered tile_map.cpp:1030-1043. Glued-index shape
    // ("layer_" + i + "/" + leaf).
    type: 'TileMap',
    at: 'tile_map.cpp:1023-1043',
    route: 'PropertyListHelper',
    sample: 'layer_0/name',
    verdict: {
      unimplemented:
        'seven glued-index leaves (name/enabled/modulate/y_sort_enabled/y_sort_origin/z_index/navigation_enabled) plus tile_data, none validated, unlike the sibling format key',
    },
  },
  {
    // Explicitly pushed OUTSIDE the PropertyListHelper family
    // (tile_map.cpp:747), NO_EDITOR|INTERNAL (storage-bearing).
    type: 'TileMap',
    at: 'tile_map.cpp:747',
    route: 'property-list',
    sample: 'format',
    verdict: { validated: true },
  },

  // --- Shader-reflected instance parameters ---
  {
    // Storage is per-instance-state (canvas_item.cpp:637-656): granted only
    // once an override for that name actually exists locally. The base type
    // and hint come from RS::canvas_item_get_instance_shader_parameter_list at
    // runtime, from whatever the attached shader declares.
    type: 'CanvasItem',
    at: 'canvas_item.cpp:637-656',
    route: 'property-list',
    sample: 'instance_shader_parameters/tint',
    verdict: {
      unimplemented:
        'shader-reflected instance uniform, unbounded name/type; needs at minimum a permissive validator like ShaderGlobalsOverride\'s params/*',
    },
  },
  {
    // Same InstanceUniforms engine class as CanvasItem, reached through the 3D
    // RenderingServer surface instead (visual_instance_3d.cpp:346-364).
    type: 'GeometryInstance3D',
    at: 'visual_instance_3d.cpp:346-364',
    route: 'property-list',
    sample: 'instance_shader_parameters/roughness_offset',
    verdict: {
      unimplemented:
        'shader-reflected instance uniform (3D RS surface), unbounded name/type; same missing permissive validator as CanvasItem',
    },
  },
  {
    type: 'MeshInstance3D',
    at: 'mesh_instance_3d.cpp:101-109',
    route: 'property-list',
    sample: 'surface_material_override/0',
    verdict: { validated: true },
  },
  {
    // Resolved whole, not by index parsing: blend_shape_properties maps the
    // FULL "blend_shapes/<name>" string to a track index, rebuilt from the
    // Mesh resource every time it changes (mesh_instance_3d.cpp:413-414). The
    // -1..1 PROPERTY_HINT_RANGE (mesh_instance_3d.cpp:103) is never enforced.
    type: 'MeshInstance3D',
    at: 'mesh_instance_3d.cpp:102-103',
    route: 'property-list',
    sample: 'blend_shapes/Smile',
    verdict: {
      unimplemented:
        'per-blend-shape weight named from the Mesh resource; PROPERTY_HINT_RANGE -1..1 is never enforced by the setter, so at minimum a float format check is missing',
    },
  },
  {
    type: 'ShaderGlobalsOverride',
    at: 'shader_globals_override.cpp:87-217',
    route: 'property-list',
    sample: 'params/fog_enabled',
    verdict: { validated: true },
  },
  {
    // get_viewport_composition_layer_extension_properties is a GDVIRTUAL
    // (openxr_extension_wrapper.cpp:379-387); zero concrete
    // OpenXRExtensionWrapper subclasses in this checkout implement it, and the
    // only engine-side constraint on a name is containing a '/'
    // (openxr_composition_layer.cpp:712-715). There is no fixed prefix to
    // register a wildcard against, so the sample below is illustrative only —
    // no such key exists in this build to validate even in principle.
    type: 'OpenXRCompositionLayer',
    at: 'openxr_composition_layer.cpp:705-716',
    route: 'property-list',
    sample: 'example_extension/enabled',
    verdict: {
      declined: 'runtime-shaped',
      because:
        "GDVIRTUAL-supplied by third-party OpenXRExtensionWrapper subclasses whose only constraint is containing a '/' (openxr_composition_layer.cpp:712-715); zero such wrappers ship in this checkout, so no fixed prefix exists to register a wildcard against and no concrete key would ever reach this build's linter",
    },
  },

  // --- Control/Window: six independently-written theme_override_* families each ---
  {
    type: 'Control',
    at: 'control.cpp:421-425',
    route: 'property-list',
    sample: 'theme_override_colors/font_color',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:429-432',
    route: 'property-list',
    sample: 'theme_override_constants/separation',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:436-439',
    route: 'property-list',
    sample: 'theme_override_fonts/font',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:443-446',
    route: 'property-list',
    sample: 'theme_override_font_sizes/font_size',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:450-453',
    route: 'property-list',
    sample: 'theme_override_icons/icon',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:457-460',
    route: 'property-list',
    sample: 'theme_override_styles/panel',
    verdict: { validated: true },
  },
  {
    // Window is not a Control descendant (its base is Viewport): this is a
    // SEPARATE, independently written override producing the same six
    // families (window.cpp vs control.cpp — different storage members,
    // different null-check macros; see themeOverrides.ts's header).
    type: 'Window',
    at: 'window.cpp:167-171',
    route: 'property-list',
    sample: 'theme_override_colors/font_color',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:178-183',
    route: 'property-list',
    sample: 'theme_override_constants/separation',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:189-195',
    route: 'property-list',
    sample: 'theme_override_fonts/font',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:200-207',
    route: 'property-list',
    sample: 'theme_override_font_sizes/font_size',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:212-219',
    route: 'property-list',
    sample: 'theme_override_icons/icon',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:224-231',
    route: 'property-list',
    sample: 'theme_override_styles/panel',
    verdict: { validated: true },
  },

  {
    type: 'GraphNode',
    at: 'graph_node.cpp:130-149',
    route: 'property-list',
    sample: 'slot/0/left_enabled',
    verdict: { validated: true },
  },

  // --- PropertyListHelper-backed GUI families ---
  {
    type: 'FileDialog',
    at: 'file_dialog.cpp:2199-2204',
    route: 'PropertyListHelper',
    sample: 'option_0/name',
    verdict: { validated: true },
  },
  {
    type: 'ItemList',
    at: 'item_list.cpp:2461-2466',
    route: 'PropertyListHelper',
    sample: 'item_0/text',
    verdict: { validated: true },
  },
  {
    // Registered under its OWN prefix "popup/item_" (menu_button.cpp:213-222),
    // distinct from PopupMenu's bare "item_". _set/_get forward into the
    // internal PopupMenu child's own set()/get() (menu_button.cpp:174-192), but
    // that child is added with add_child(..., INTERNAL_MODE_FRONT) and never
    // owned, so packed_scene.cpp's save_node test never saves it independently
    // — "popup/item_0/text" on MenuButton is the only place this data reaches
    // a .tscn, a real distinct family rather than duplicate/dead storage.
    type: 'MenuButton',
    at: 'menu_button.cpp:213-222',
    route: 'PropertyListHelper',
    sample: 'popup/item_0/text',
    verdict: { validated: true },
  },
  {
    // Same forwarding shape as MenuButton, smaller leaf set (no
    // checkable/checked — OptionButton forces every item radio-checkable
    // itself).
    type: 'OptionButton',
    at: 'option_button.cpp:626-633',
    route: 'PropertyListHelper',
    sample: 'popup/item_0/text',
    verdict: { validated: true },
  },
  {
    type: 'PopupMenu',
    at: 'popup_menu.cpp:3319-3327',
    route: 'PropertyListHelper',
    sample: 'item_0/text',
    verdict: { validated: true },
  },
  {
    type: 'TabBar',
    at: 'tab_bar.cpp:2188-2193',
    route: 'PropertyListHelper',
    sample: 'tab_0/title',
    verdict: { validated: true },
  },
  {
    // A SEPARATE PropertyListHelper instance from TabBar's own (own
    // "static inline PropertyListHelper base_property_helper", tab_container.h:113),
    // registered tab_container.cpp:1270-1276, with its own leaf set (title,
    // icon, disabled, hidden — no tooltip). TabContainer is the only class in
    // this batch with no registered wildcard for its own family at all.
    type: 'TabContainer',
    at: 'tab_container.cpp:1270-1276',
    route: 'PropertyListHelper',
    sample: 'tab_0/title',
    verdict: {
      unimplemented:
        "TabContainer's OWN glued-index family (title/icon/disabled/hidden), a separate PropertyListHelper instance from TabBar's already-validated one; nothing here is registered",
    },
  },
];

/** Rows counted as a live gap; only ever moves down as one is fixed. */
const UNIMPLEMENTED_COUNT = 17;

type Verdict = RouteRow['verdict'];

function isValidated(verdict: Verdict): verdict is { validated: true } {
  return 'validated' in verdict;
}

function isUnimplemented(verdict: Verdict): verdict is { unimplemented: string } {
  return 'unimplemented' in verdict;
}

function isDeclined(
  verdict: Verdict
): verdict is { declined: 'no-storage-bit' | 'never-owned' | 'runtime-shaped'; because: string } {
  return 'declined' in verdict;
}

/**
 * Every concretely registered node type — real parser slices, the same
 * population `ownValidatorCoverage`'s registry half sweeps — that is `type`
 * itself or descends from it. `descendsFrom` matches the type itself, so a
 * declaring class that is ALSO a concrete leaf (`BoneConstraint3D`,
 * `GraphNode`, …) is included without special-casing.
 */
function concreteDescendants(type: string): string[] {
  return nodeRegistry
    .getAllTypeNames()
    .filter((candidate) => descendsFrom(candidate, type))
    .sort();
}

const validatedRows = ROWS.filter((row): row is RouteRow & { verdict: { validated: true } } =>
  isValidated(row.verdict)
);
const unimplementedRows = ROWS.filter(
  (row): row is RouteRow & { verdict: { unimplemented: string } } => isUnimplemented(row.verdict)
);

describe('property-list route coverage', () => {
  it('covers exactly the 38-class population, MultiplayerSpawner excluded', () => {
    const types = new Set(ROWS.map((row) => row.type));
    expect(types.size).toBe(38);
    expect(types.has('MultiplayerSpawner')).toBe(false);
  });

  it('classifies every row into exactly one verdict', () => {
    for (const row of ROWS) {
      const flags = [isValidated(row.verdict), isUnimplemented(row.verdict), isDeclined(row.verdict)];
      expect(flags.filter(Boolean), `${row.type} ${row.sample}`).toHaveLength(1);
    }
  });

  it('gives every declined row a reason', () => {
    for (const row of ROWS) {
      if (isDeclined(row.verdict)) {
        expect(row.verdict.because.length, `${row.type} ${row.sample}`).toBeGreaterThan(0);
      }
    }
  });

  describe.each(validatedRows)('$type $sample ($at)', (row) => {
    const descendants = concreteDescendants(row.type);

    it('reaches at least one concretely registered type', () => {
      expect(descendants.length, `${row.type} has no concrete registered descendant`).toBeGreaterThan(0);
    });

    it('resolves on the declaring type', () => {
      expect(validatorRegistry.findValidator(row.type, row.sample)).not.toBeNull();
    });

    it.each(descendants)('resolves on %s', (type) => {
      expect(validatorRegistry.findValidator(type, row.sample)).not.toBeNull();
    });
  });

  describe.each(unimplementedRows)('$type $sample ($at) is a live gap', (row) => {
    it('still resolves to no validator, so the row cannot go stale silently', () => {
      expect(validatorRegistry.findValidator(row.type, row.sample)).toBeNull();
    });
  });

  it('pins the unimplemented count, so it can only move by editing this file', () => {
    // Exact equality, not a ceiling: it must fall if a row is fixed and rise
    // only if a new row is added deliberately, both of which require touching
    // this constant, which is the whole point of the ratchet.
    expect(unimplementedRows.length).toBe(UNIMPLEMENTED_COUNT);
  });
});
