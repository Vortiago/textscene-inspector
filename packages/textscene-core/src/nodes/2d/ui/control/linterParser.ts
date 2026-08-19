/**
 * Base Control strict validators for linting.
 *
 * Control is the root of the 2D UI family (Label, Button, Panel, the
 * *Containers, …). Registering the shared layout/anchor/offset + theme-override
 * validators here — once, under `'Control'` — makes them apply to every Control
 * subclass through the ValidatorRegistry base-walk (see linter/nodeBaseTypes.ts),
 * closing the gap where the render parser coerced these values while the linter
 * ignored them entirely.
 *
 * Validators are deliberately format-lenient (accept anything the renderer
 * accepts, reject only malformed literals) so widening linter coverage to the
 * whole UI family does not introduce false positives on real Godot scenes.
 */

import '../../../canvasitem/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v, shape, propertyError } from '../../../../linter/validators/index.js';
import { THEME_OVERRIDE_VALIDATORS } from '../../../../linter/validators/themeOverrides.js';
import {
  ARRAY_LITERAL_RE,
  dropTrailingComma,
  NODE_PATH_LITERAL_RE,
  splitTopLevel,
} from '../../../../godot/index.js';

/**
 * `Array[NodePath]([…])` — the four `accessibility_*_nodes` properties
 * (control.cpp:4313-4316, `PROPERTY_HINT_ARRAY_TYPE "NodePath"` on a
 * `Variant::ARRAY`, not `PACKED_*`) are `TypedArray<NodePath>` getters, so the
 * serialiser takes the typed-array branch (`core/variant/variant_parser.cpp:2341-2344`)
 * rather than any packed spelling. The bare `[NodePath(…), …]` form loads too:
 * `TypedArray(const Array&)` (`core/variant/typed_array.h:43-46`) calls `assign()`
 * on an untyped incoming array, the same trap CodeEdit's array properties
 * document. Setters (control.cpp:2203-2247) are bare assigns, no ERR_FAIL, so
 * this is a shape check only: an empty array is legal and every element must
 * itself be a `NodePath("…")` literal, empty path included.
 */
function nodePathArray(name: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase()}_FORMAT`;
  const reject = (key: string, line: number, value: string) =>
    propertyError(
      key,
      line,
      `Property '${name}' must be Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …], got: ${value}`,
      code
    );
  return shape((key, value, line) => {
    const trimmed = value.trim();
    const typed = /^Array\s*\[\s*NodePath\s*\]\s*\(\s*\[([\s\S]*)\]\s*\)$/.exec(trimmed);
    const match = typed ?? ARRAY_LITERAL_RE.exec(trimmed);
    if (!match) return reject(key, line, value);
    const body = match[1]!.trim();
    if (body === '') return null;
    for (const element of dropTrailingComma(splitTopLevel(body))) {
      if (!NODE_PATH_LITERAL_RE.test(element)) return reject(key, line, value);
    }
    return null;
  }, 'Array[NodePath]([NodePath("path"), …]) or [NodePath("path"), …]');
}

/**
 * `Control::SizeFlags`, the bits the `size_flags_*` hint strings name
 * (control.h:80-83, bound as `BIND_BITFIELD_FLAG` at control.cpp:4388-4392).
 * `SIZE_SHRINK_BEGIN = 0` (control.h:79) is the empty set and `SIZE_EXPAND_FILL
 * = 3` (control.h:85, bound at control.cpp:4390) is `SIZE_EXPAND | SIZE_FILL`,
 * so neither is a bit of its own.
 */
const SIZE_FLAGS_LABELS = {
  1: 'SIZE_FILL',
  2: 'SIZE_EXPAND',
  4: 'SIZE_SHRINK_CENTER',
  8: 'SIZE_SHRINK_END',
};

validatorRegistry.registerAll('Control', {
  // Layout regime + anchors/offsets (the free/anchored path).
  // control.cpp:4210, ENUM "Position,Anchors,Container,Uncontrolled" (4 labels,
  // matching LayoutMode 0-3 exactly, control.h:147-152). _set_layout_mode
  // (control.cpp:919-935) assigns unconditionally, no ERR_FAIL.
  layout_mode: v.int('layout_mode', { min: 0, max: 3, hinted: 'control.cpp:4210' }),
  // control.cpp:4245, ENUM built from the preset table ("Custom:-1" plus 16
  // named presets 0-15). Both ends are genuinely enforced, just by two
  // different guards: -1 is special-cased as always valid
  // (_set_anchors_layout_preset early-returns on it, control.cpp:983-988);
  // anything else reaches set_anchors_preset's `ERR_FAIL_INDEX((int)p_preset,
  // 16)` (control.cpp:1116), which also rejects anything below -1.
  anchors_preset: v.int('anchors_preset', {
    min: -1,
    max: 15,
    enforced: { min: 'control.cpp:983', max: 'control.cpp:1116' },
  }),
  anchor_left: v.float('anchor_left'),
  anchor_top: v.float('anchor_top'),
  anchor_right: v.float('anchor_right'),
  anchor_bottom: v.float('anchor_bottom'),
  offset_left: v.float('offset_left'),
  offset_top: v.float('offset_top'),
  offset_right: v.float('offset_right'),
  offset_bottom: v.float('offset_bottom'),
  // control.cpp:4261, ENUM "Left,Right,Both". set_h_grow_direction:
  // `ERR_FAIL_INDEX((int)p_direction, 3)` (control.cpp:861).
  grow_horizontal: v.int('grow_horizontal', { min: 0, max: 2, enforced: 'control.cpp:861' }),
  // control.cpp:4262, ENUM "Top,Bottom,Both". set_v_grow_direction:
  // `ERR_FAIL_INDEX((int)p_direction, 3)` (control.cpp:878).
  grow_vertical: v.int('grow_vertical', { min: 0, max: 2, enforced: 'control.cpp:878' }),
  rotation: v.float('rotation'),
  scale: v.vector2('scale'),
  pivot_offset: v.vector2('pivot_offset'),
  pivot_offset_ratio: v.vector2('pivot_offset_ratio'),

  // Container-child sizing.
  // control.cpp:4275/4276 hint PROPERTY_HINT_FLAGS, not a RANGE, and both state
  // the same four bits: "Fill:1,Expand:2,Shrink Center:4,Shrink End:8". The
  // vertical hint is not the narrower one — the per-parent filter at
  // control.cpp:555-562 is `is_editor_hint()`-gated and reads the live parent
  // Container, so it grounds nothing static.
  // set_h_size_flags (control.cpp:1845) and set_v_size_flags (control.cpp:1859)
  // bare-assign the BitField: no mask, no clamp, no ERR_FAIL. A bit outside the
  // hint is therefore KEPT, merely unreachable from the inspector, which is
  // `hintedBitField`'s warning tier and not `maskedBitField`'s error tier.
  size_flags_horizontal: hintedBitField('size_flags_horizontal', {
    hinted: 'control.cpp:4275',
    labels: SIZE_FLAGS_LABELS,
  }),
  size_flags_vertical: hintedBitField('size_flags_vertical', {
    hinted: 'control.cpp:4276',
    labels: SIZE_FLAGS_LABELS,
  }),
  // control.cpp:4277, "0,20,0.01,or_greater": only the 0 floor is closed.
  // set_stretch_ratio (control.cpp:1868-1875) assigns unconditionally.
  size_flags_stretch_ratio: v.nonNegativeFloat('size_flags_stretch_ratio', {
    hinted: 'control.cpp:4277',
  }),
  custom_minimum_size: v.vector2('custom_minimum_size'),

  // control.cpp:4297, ENUM "None,Click,All,Accessibility" (FocusMode 0-3,
  // control.h:65-70). set_focus_mode (control.cpp:2267) is
  // `ERR_FAIL_INDEX((int)p_focus_mode, 4)`: genuinely enforced, so out of range
  // is an error rather than a hint warning. Every Control descendant accepted
  // any value until this existed, including the ones whose own subclass bound is
  // narrower (GraphNode.slots_focus_mode enforces 1-3, TabContainer's
  // tab_focus_mode is only hinted 0-2 because it delegates to this same guard).
  // control.cpp:4301, ENUM "Stop,Pass (Propagate Up),Ignore" (MouseFilter 0-2,
  // control.h:88-92). set_mouse_filter (control.cpp:1923) is
  // `ERR_FAIL_INDEX(p_filter, 3)`: enforced, so out of range is an error. Like
  // focus_mode this had no validator anywhere, so every Control descendant
  // accepted any value.
  mouse_filter: v.enumInt(
    'mouse_filter',
    0,
    2,
    { 0: 'STOP', 1: 'PASS', 2: 'IGNORE' },
    { enforced: 'control.cpp:1923' }
  ),
  focus_mode: v.enumInt(
    'focus_mode',
    0,
    3,
    { 0: 'NONE', 1: 'CLICK', 2: 'ALL', 3: 'ACCESSIBILITY' },
    { enforced: 'control.cpp:2267' }
  ),

  // Shared with Window — Godot emits this family from both, identically
  // (control.cpp:432/446 state the same two hints as window.cpp:183/207).
  // Grounding for these two lives in linter/validators/themeOverrides.ts,
  // which this slice does not own.
  ...THEME_OVERRIDE_VALIDATORS,

  // "Accessibility" group (control.cpp:4310-4316). Setters are bare assigns
  // (control.cpp:2166-2247), no ERR_FAIL anywhere in the group.
  accessibility_name: v.quotedString('accessibility_name'),
  accessibility_description: v.quotedString('accessibility_description'),
  // control.cpp:4312, ENUM "Off,Polite,Assertive" = DisplayServer::AccessibilityLiveMode
  // (3 BIND_ENUM_CONSTANTs, display/display_server.cpp:1768-1770). Field is
  // full-width (control.h:259), not a bitfield: hinted, not enforced.
  accessibility_live: v.enumInt(
    'accessibility_live',
    0,
    2,
    { 0: 'OFF', 1: 'POLITE', 2: 'ASSERTIVE' },
    { hinted: 'control.cpp:4312' }
  ),
  accessibility_controls_nodes: nodePathArray('accessibility_controls_nodes'),
  accessibility_described_by_nodes: nodePathArray('accessibility_described_by_nodes'),
  accessibility_labeled_by_nodes: nodePathArray('accessibility_labeled_by_nodes'),
  accessibility_flow_to_nodes: nodePathArray('accessibility_flow_to_nodes'),

  // "Focus" group. Neighbor/next/previous are NODE_PATH with only
  // PROPERTY_HINT_NODE_PATH_VALID_TYPES (an editor-picker filter, not a value
  // bound); setters (control.cpp:2618-2648) bare-assign the path itself — the
  // ERR_FAIL_INDEX at :2620 guards the internal Side index, not the value.
  focus_neighbor_left: v.nodePath('focus_neighbor_left'),
  focus_neighbor_top: v.nodePath('focus_neighbor_top'),
  focus_neighbor_right: v.nodePath('focus_neighbor_right'),
  focus_neighbor_bottom: v.nodePath('focus_neighbor_bottom'),
  focus_next: v.nodePath('focus_next'),
  focus_previous: v.nodePath('focus_previous'),
  // control.cpp:2295, ERR_FAIL_INDEX((int)p_focus_behavior_recursive, 3) — enforced.
  // ENUM "Inherited,Disabled,Enabled" (control.h:72-76, INHERITED=0..ENABLED=2).
  focus_behavior_recursive: v.enumInt(
    'focus_behavior_recursive',
    0,
    2,
    { 0: 'INHERITED', 1: 'DISABLED', 2: 'ENABLED' },
    { enforced: 'control.cpp:2295' }
  ),

  // "Mouse" group.
  // control.cpp:1953, ERR_FAIL_INDEX(p_mouse_behavior_recursive, 3) — enforced.
  // Same three labels/values as focus_behavior_recursive (control.h:94-98).
  mouse_behavior_recursive: v.enumInt(
    'mouse_behavior_recursive',
    0,
    2,
    { 0: 'INHERITED', 1: 'DISABLED', 2: 'ENABLED' },
    { enforced: 'control.cpp:1953' }
  ),
  mouse_force_pass_scroll_events: v.boolean('mouse_force_pass_scroll_events'),
  // control.cpp:2877, ERR_FAIL_INDEX(int(p_shape), CURSOR_MAX) where
  // CURSOR_MAX=17 (control.h:100-118, ARROW=0..HELP=16) — enforced.
  mouse_default_cursor_shape: v.enumInt(
    'mouse_default_cursor_shape',
    0,
    16,
    {
      0: 'ARROW',
      1: 'IBEAM',
      2: 'POINTING_HAND',
      3: 'CROSS',
      4: 'WAIT',
      5: 'BUSY',
      6: 'DRAG',
      7: 'CAN_DROP',
      8: 'FORBIDDEN',
      9: 'VSIZE',
      10: 'HSIZE',
      11: 'BDIAGSIZE',
      12: 'FDIAGSIZE',
      13: 'MOVE',
      14: 'VSPLIT',
      15: 'HSPLIT',
      16: 'HELP',
    },
    { enforced: 'control.cpp:2877' }
  ),

  // Misc.
  clip_contents: v.boolean('clip_contents'),
  localize_numeral_system: v.boolean('localize_numeral_system'),
  // control.cpp:3539, ERR_FAIL_INDEX(p_direction, LAYOUT_DIRECTION_MAX) where
  // MAX=5 (control.h:154-160, INHERITED=0..SYSTEM_LOCALE=4). The early return
  // at :3536 fires only when the incoming value equals data.layout_dir, which
  // is itself only ever assigned a value that already cleared this same
  // guard — so it can never intercept an out-of-range write. Enforced.
  layout_direction: v.enumInt(
    'layout_direction',
    0,
    4,
    { 0: 'INHERITED', 1: 'APPLICATION_LOCALE', 2: 'LTR', 3: 'RTL', 4: 'SYSTEM_LOCALE' },
    { enforced: 'control.cpp:3539' }
  ),
  // shortcut_context declares Variant::OBJECT + PROPERTY_HINT_NODE_TYPE
  // (control.cpp:4307, takes a live `const Node *`), and packed_scene.cpp:884-891
  // converts a Node value to `get_path_to(n)` — a NodePath — before writing it.
  // That is what the WRITER emits; the loader also takes `null`, since NIL
  // converts to OBJECT (variant.cpp:543-545) and set_shortcut_context handles a
  // nullptr by storing an empty ObjectID (control.cpp:2022-2027).
  shortcut_context: v.nodePath('shortcut_context', { orNull: true }),

  // "Theme" group. `null` is legal here and the combinator accepts it; see
  // its docblock for why the write-side STORE_IF_NULL reasoning is a red
  // herring.
  theme: v.resourceReference('theme'),
  // control.cpp:3017-3022, StringName param, bare assign. The GETTER
  // (control.cpp:3028, `StringName Control::get_theme_type_variation`) is what
  // the serialiser reads despite ADD_PROPERTY declaring Variant::STRING
  // (control.cpp:4320) — StringName always writes `&"…"` (variant_parser.cpp:2147-2151).
  theme_type_variation: v.stringName('theme_type_variation'),
  // control.cpp:3657-3660, bare assign to a full-width field (control.h:298).
  // ENUM "Inherit,Always,Disabled" = Node::AutoTranslateMode (3
  // BIND_ENUM_CONSTANTs, main/node.cpp:4032-4034). Hinted, not enforced.
  tooltip_auto_translate_mode: v.enumInt(
    'tooltip_auto_translate_mode',
    0,
    2,
    { 0: 'INHERIT', 1: 'ALWAYS', 2: 'DISABLED' },
    { hinted: 'control.cpp:4288' }
  ),
  tooltip_text: v.quotedString('tooltip_text'),
});
