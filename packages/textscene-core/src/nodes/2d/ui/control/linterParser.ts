/**
 * Base Control strict validators. Registered once under `'Control'`, they reach every
 * Control subclass through the ValidatorRegistry base-walk (godot/nodeBaseTypes.ts).
 * They reject only malformed literals, so a real Godot scene of any UI type passes.
 */

import '../../../canvasitem/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v, shape, propertyError } from '../../../../linter/validators/index.js';
import { THEME_OVERRIDE_VALIDATORS } from '../../../../linter/validators/themeOverrides.js';
import {
  ARRAY_LITERAL_RE,
  CURSOR_MAX,
  CURSOR_SHAPES,
  dropTrailingComma,
  NODE_PATH_LITERAL_RE,
  splitTopLevel,
} from '../../../../godot/index.js';

/**
 * The four `accessibility_*_nodes` properties (control.cpp:4313-4316) have `TypedArray<NodePath>`
 * getters, so they serialise as `Array[NodePath]([…])` (`core/variant/variant_parser.cpp:2341-2344`).
 * A bare `[NodePath(…), …]` loads too: `TypedArray(const Array&)` calls `assign()`
 * (`core/variant/typed_array.h:43-46`).
 */
function nodePathArray(name: string): PropertyValidator {
  // The setters (control.cpp:2203-2247) have no ERR_FAIL, so this checks the shape only: an empty
  // array is legal, and each element is a `NodePath("…")` literal, the empty path included.
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
 * The `Control::SizeFlags` bits the `size_flags_*` hints name (control.h:80-83,
 * control.cpp:4388-4392). `SIZE_SHRINK_BEGIN = 0` (control.h:79) is the empty set and
 * `SIZE_EXPAND_FILL = 3` (control.h:85, control.cpp:4390) is `SIZE_EXPAND | SIZE_FILL`.
 */
const SIZE_FLAGS_LABELS = {
  1: 'SIZE_FILL',
  2: 'SIZE_EXPAND',
  4: 'SIZE_SHRINK_CENTER',
  8: 'SIZE_SHRINK_END',
};

validatorRegistry.registerAll('Control', {
  // control.cpp:4210, ENUM "Position,Anchors,Container,Uncontrolled", LayoutMode 0-3
  // (control.h:147-152). _set_layout_mode (control.cpp:919-935) has no ERR_FAIL.
  layout_mode: v.int('layout_mode', { min: 0, max: 3, hinted: 'control.cpp:4210' }),
  // control.cpp:4245, ENUM "Custom:-1" plus presets 0-15. `ERR_FAIL_INDEX((int)p_preset, 16)` (control.cpp:1116)
  // refuses -5 and 16 alike. The floor is -1: `_set_anchors_layout_preset` returns first on it (control.cpp:983-989).
  // In layout modes 0 (default, control.h:201) and 2, control.cpp:991-994 drops every write, which is
  // still the error tier: the stored value is not the written one.
  anchors_preset: v.int('anchors_preset', {
    min: -1,
    max: 15,
    enforced: 'control.cpp:1116',
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

  // control.cpp:4275/4276 hint the same PROPERTY_HINT_FLAGS "Fill:1,Expand:2,Shrink Center:4,Shrink End:8".
  // The per-parent filter (control.cpp:555-562) is editor-only and reads the live parent.
  // set_h_size_flags (control.cpp:1845) and set_v_size_flags (control.cpp:1859) have no mask,
  // so an unhinted bit is kept: `hintedBitField`'s warning, not `maskedBitField`'s error.
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
  // control.cpp:1729 drops a non-finite component ("Prevent infinite loop"), and the
  // equality return above it never catches one, so the size stays (0, 0).
  custom_minimum_size: v.vector2('custom_minimum_size', { finite: 'control.cpp:1729' }),

  // control.cpp:4301, ENUM "Stop,Pass (Propagate Up),Ignore" (MouseFilter 0-2,
  // control.h:88-92). set_mouse_filter (control.cpp:1923) is `ERR_FAIL_INDEX(p_filter, 3)`.
  mouse_filter: v.enumInt(
    'mouse_filter',
    0,
    2,
    { 0: 'STOP', 1: 'PASS', 2: 'IGNORE' },
    { enforced: 'control.cpp:1923' }
  ),
  // control.cpp:4297, ENUM "None,Click,All,Accessibility" (FocusMode 0-3, control.h:65-70).
  // set_focus_mode (control.cpp:2267) is `ERR_FAIL_INDEX((int)p_focus_mode, 4)`.
  focus_mode: v.enumInt(
    'focus_mode',
    0,
    3,
    { 0: 'NONE', 1: 'CLICK', 2: 'ALL', 3: 'ACCESSIBILITY' },
    { enforced: 'control.cpp:2267' }
  ),

  // Shared with Window: control.cpp:432/446 state the same two hints as window.cpp:183/207.
  // linter/validators/themeOverrides.ts holds the grounding.
  ...THEME_OVERRIDE_VALIDATORS,

  // "Accessibility" group (control.cpp:4310-4316). The setters (control.cpp:2166-2247) have no ERR_FAIL.
  accessibility_name: v.quotedString('accessibility_name'),
  accessibility_description: v.quotedString('accessibility_description'),
  // control.cpp:4312, ENUM "Off,Polite,Assertive" = DisplayServer::AccessibilityLiveMode
  // (display/display_server.cpp:1768-1770). The field is full-width (control.h:259): hinted, not enforced.
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

  // "Focus" group. PROPERTY_HINT_NODE_PATH_VALID_TYPES filters the editor picker and bounds
  // no value. The setters (control.cpp:2618-2648) assign the path: the ERR_FAIL_INDEX at
  // :2620 guards the Side index.
  focus_neighbor_left: v.nodePath('focus_neighbor_left'),
  focus_neighbor_top: v.nodePath('focus_neighbor_top'),
  focus_neighbor_right: v.nodePath('focus_neighbor_right'),
  focus_neighbor_bottom: v.nodePath('focus_neighbor_bottom'),
  focus_next: v.nodePath('focus_next'),
  focus_previous: v.nodePath('focus_previous'),
  // control.cpp:2295, ERR_FAIL_INDEX((int)p_focus_behavior_recursive, 3).
  // ENUM "Inherited,Disabled,Enabled" (control.h:72-76).
  focus_behavior_recursive: v.enumInt(
    'focus_behavior_recursive',
    0,
    2,
    { 0: 'INHERITED', 1: 'DISABLED', 2: 'ENABLED' },
    { enforced: 'control.cpp:2295' }
  ),

  // "Mouse" group. control.cpp:1953, ERR_FAIL_INDEX(p_mouse_behavior_recursive, 3).
  // The values of focus_behavior_recursive (control.h:94-98).
  mouse_behavior_recursive: v.enumInt(
    'mouse_behavior_recursive',
    0,
    2,
    { 0: 'INHERITED', 1: 'DISABLED', 2: 'ENABLED' },
    { enforced: 'control.cpp:1953' }
  ),
  mouse_force_pass_scroll_events: v.boolean('mouse_force_pass_scroll_events'),
  // control.cpp:2877, ERR_FAIL_INDEX(int(p_shape), CURSOR_MAX). The table lives in
  // `godot/control.ts` because SubViewportContainer's rule reads it too.
  mouse_default_cursor_shape: v.enumInt(
    'mouse_default_cursor_shape',
    0,
    CURSOR_MAX - 1,
    CURSOR_SHAPES,
    { enforced: 'control.cpp:2877' }
  ),

  clip_contents: v.boolean('clip_contents'),
  localize_numeral_system: v.boolean('localize_numeral_system'),
  // control.cpp:3539, ERR_FAIL_INDEX(p_direction, LAYOUT_DIRECTION_MAX = 5) (control.h:154-160).
  // The early return at :3536 compares with data.layout_dir, which holds only values
  // that passed this guard, so it never catches an out-of-range write.
  layout_direction: v.enumInt(
    'layout_direction',
    0,
    4,
    { 0: 'INHERITED', 1: 'APPLICATION_LOCALE', 2: 'LTR', 3: 'RTL', 4: 'SYSTEM_LOCALE' },
    { enforced: 'control.cpp:3539' }
  ),
  // Variant::OBJECT with PROPERTY_HINT_NODE_TYPE (control.cpp:4307): the writer stores
  // `get_path_to(n)`, a NodePath (packed_scene.cpp:884-891). `null` loads too: NIL converts to
  // OBJECT (variant.cpp:543-545), and the setter stores an empty ObjectID (control.cpp:2022-2027).
  shortcut_context: v.nodePath('shortcut_context', { orNull: true }),

  // "Theme" group. `null` is legal, and the combinator accepts it.
  theme: v.resourceReference('theme'),
  // control.cpp:3017-3022 assigns a StringName. ADD_PROPERTY declares Variant::STRING
  // (control.cpp:4320), but the StringName getter (control.cpp:3028) decides the form: `&"…"`
  // (variant_parser.cpp:2147-2151).
  theme_type_variation: v.stringName('theme_type_variation'),
  // control.cpp:3657-3660 assigns a full-width field (control.h:298). ENUM "Inherit,Always,Disabled"
  // = Node::AutoTranslateMode (main/node.cpp:4032-4034). Hinted, not enforced.
  tooltip_auto_translate_mode: v.enumInt(
    'tooltip_auto_translate_mode',
    0,
    2,
    { 0: 'INHERIT', 1: 'ALWAYS', 2: 'DISABLED' },
    { hinted: 'control.cpp:4288' }
  ),
  tooltip_text: v.quotedString('tooltip_text'),
});
