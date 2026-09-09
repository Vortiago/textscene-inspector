/**
 * GraphEdit strict validators for linting.
 *
 * Declare only GraphEdit's OWN members — the ones doc/classes/GraphEdit.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { shape, v } from '../../../../linter/validators/v.js';
import { propertyError } from '../../../../linter/validators/propertyError.js';

/**
 * `type_names` keeps a plain `Dictionary` member (graph_edit.h:314) returned
 * untyped (graph_edit.h:434). `PROPERTY_HINT_DICTIONARY_TYPE "int;String"`
 * (graph_edit.cpp:3077) only types the inspector's key/value widgets, so
 * `Dictionary::is_typed()` stays false and no `Dictionary[int, String](…)`
 * wrapper is ever written: the saved form is a bare `{…}`.
 */
const DICTIONARY_LITERAL_RE = /^\{[\s\S]*\}$/;

validatorRegistry.registerAll('GraphEdit', {
  // Ungrouped run, graph_edit.cpp:3069-3077.
  // graph_edit.cpp:3069: VECTOR2, PROPERTY_HINT_NONE "suffix:px".
  // set_scroll_offset clamps to [min_scroll_offset, max_scroll_offset -
  // get_size()] (graph_edit.cpp:407), both derived from the laid-out children,
  // so there is no bound a static file can be measured against.
  scroll_offset: v.vector2('scroll_offset'),
  // graph_edit.cpp:3070: bare BOOL. set_show_grid (graph_edit.cpp:2729-2737) is
  // an assignment plus a button sync.
  show_grid: v.boolean('show_grid'),
  // graph_edit.cpp:3071: PROPERTY_HINT_ENUM "Lines,Dots" over the two-member
  // GridPattern enum (graph_edit.h:146-149). set_grid_pattern
  // (graph_edit.cpp:2743-2750) stores the int with no membership check, so a
  // third value is kept and merely unreachable from the inspector: WARNING.
  grid_pattern: v.enumInt(
    'grid_pattern',
    0,
    1,
    { 0: 'GRID_PATTERN_LINES', 1: 'GRID_PATTERN_DOTS' },
    { hinted: 'graph_edit.cpp:3071' }
  ),
  // graph_edit.cpp:3072: bare BOOL. set_snapping_enabled (graph_edit.cpp:2703-2711)
  // assigns and syncs the toolbar toggle.
  snapping_enabled: v.boolean('snapping_enabled'),
  // graph_edit.cpp:3073: INT, PROPERTY_HINT_NONE "suffix:px", so the bound is in
  // the setter, not a hint. set_snapping_distance ERR_FAIL_COND_MSGs outside
  // [GRID_MIN_SNAPPING_DISTANCE, GRID_MAX_SNAPPING_DISTANCE] inclusive
  // (graph_edit.cpp:2718), the constants being 2 and 100 (graph_edit.cpp:57-58).
  // A refused write is an ERROR at both ends.
  snapping_distance: v.int('snapping_distance', {
    min: 2,
    max: 100,
    enforced: 'graph_edit.cpp:2718',
  }),
  // graph_edit.cpp:3074: PROPERTY_HINT_ENUM "Scroll Zooms,Scroll Pans" over
  // PanningScheme (graph_edit.h:141-144). set_panning_scheme
  // (graph_edit.cpp:2418-2421) casts the int into ViewPanner unchecked: WARNING.
  panning_scheme: v.enumInt(
    'panning_scheme',
    0,
    1,
    { 0: 'SCROLL_ZOOMS', 1: 'SCROLL_PANS' },
    { hinted: 'graph_edit.cpp:3074' }
  ),
  // graph_edit.cpp:3075: bare BOOL. set_right_disconnects
  // (graph_edit.cpp:2509-2511) is an assignment.
  right_disconnects: v.boolean('right_disconnects'),
  // graph_edit.cpp:3077: DICTIONARY. set_type_names (graph_edit.cpp:1194-1196)
  // is a bare assignment, so only the literal's shape can be wrong.
  type_names: shape((key, value, line) => {
    if (!DICTIONARY_LITERAL_RE.test(value)) {
      return propertyError(
        key,
        line,
        `Property 'type_names' must be a Dictionary literal like {} or { 0: "Number" }, got: ${value}`,
        'INVALID_TYPE_NAMES_FORMAT'
      );
    }
    return null;
  }, 'Dictionary literal ({…})'),

  // "Connection Lines" group, graph_edit.cpp:3079-3083.
  // graph_edit.cpp:3080: FLOAT, PROPERTY_HINT_NONE.
  // set_connection_lines_curvature (graph_edit.cpp:2892-2899) assigns and
  // redraws. The class reference calls 0 "straight lines" but names no ceiling,
  // and prose is never a bound (ADR-0032), so this stays a format check.
  connection_lines_curvature: v.float('connection_lines_curvature'),
  // graph_edit.cpp:3081: PROPERTY_HINT_RANGE "0,100,0.1,suffix:px". The two ends
  // have different authority: set_connection_lines_thickness ERR_FAIL_COND_MSGs
  // on `p_thickness < 0` (graph_edit.cpp:2907), so under zero is an ERROR, while
  // the hint's 100 has no `or_greater` yet the setter assigns any larger value
  // through unchanged, so over it is only a WARNING.
  connection_lines_thickness: v.float('connection_lines_thickness', {
    min: 0,
    max: 100,
    enforced: { min: 'graph_edit.cpp:2907' },
    hinted: { max: 'graph_edit.cpp:3081' },
  }),
  // graph_edit.cpp:3082: bare BOOL.
  connection_lines_antialiased: v.boolean('connection_lines_antialiased'),
  // graph_edit.cpp:3083: ARRAY with PROPERTY_HINT_ARRAY_TYPE naming Dictionary.
  // Declared Variant::ARRAY but the getter returns TypedArray<Dictionary>
  // (graph_edit.h:355), so the saved spelling carries the wrapper. The bare
  // `[…]` loads too: `TypedArray<T>(const Array &)` assigns an untyped array
  // (core/variant/typed_array.h:43-50). Per-element grammar goes unchecked
  // because set_connections (graph_edit.cpp:2533-2543) reads each key with
  // `operator[]`, which default-constructs a missing one rather than failing.
  connections: v.arrayLiteral('connections', { typedAs: 'Dictionary' }),

  // "Zoom" group, graph_edit.cpp:3085-3089. All four are PROPERTY_HINT_NONE.
  // graph_edit.cpp:3086: set_zoom defers to set_zoom_custom, which CLAMPs to
  // [zoom_min, zoom_max] (graph_edit.cpp:2434). Both limits are themselves
  // authorable, and the clamp re-runs on every later limit write, so what the
  // engine keeps depends on the order the file lists the three in. Nothing
  // static to check here; see linter.ts for the part that IS order-independent.
  zoom: v.float('zoom'),
  // graph_edit.cpp:3087: set_zoom_min ERR_FAIL_COND_MSGs on `p_zoom_min >
  // zoom_max` (graph_edit.cpp:2480), a comparison against a sibling property
  // rather than a constant, so the inverted pair is linter.ts's rule.
  zoom_min: v.float('zoom_min'),
  // graph_edit.cpp:3088: the mirror guard, `p_zoom_max < zoom_min`
  // (graph_edit.cpp:2495).
  zoom_max: v.float('zoom_max'),
  // graph_edit.cpp:3089: set_zoom_step opens with
  // `p_zoom_step = std::abs(p_zoom_step);` (graph_edit.cpp:2465), so a negative
  // step is silently rewritten to its magnitude, an altered value, hence ERROR.
  zoom_step: v.nonNegativeFloat('zoom_step', {
    enforced: { min: 'graph_edit.cpp:2465' },
    finite: 'graph_edit.cpp:2466',
  }),

  // "Minimap" group, graph_edit.cpp:3091-3094.
  // graph_edit.cpp:3092: BOOL with PROPERTY_HINT_GROUP_ENABLE, which only makes
  // the inspector draw the group's checkbox; the value still serialises.
  minimap_enabled: v.boolean('minimap_enabled'),
  // graph_edit.cpp:3093: VECTOR2, PROPERTY_HINT_NONE "suffix:px".
  // set_minimap_size forwards to Control::set_size (graph_edit.cpp:2771), which
  // raises the value to the minimap's minimum size, a runtime quantity, so
  // again no static bound.
  minimap_size: v.vector2('minimap_size'),
  // graph_edit.cpp:3094: FLOAT, PROPERTY_HINT_NONE. set_minimap_opacity
  // (graph_edit.cpp:2786-2792) stores it as the minimap's modulate alpha, and
  // Color's constructor does not clamp its components, so nothing is refused.
  minimap_opacity: v.float('minimap_opacity'),

  // "Toolbar Menu" group, graph_edit.cpp:3096-3102: six bare BOOLs, each setter
  // a visibility toggle on a child button.
  show_menu: v.boolean('show_menu'),
  show_zoom_label: v.boolean('show_zoom_label'),
  show_zoom_buttons: v.boolean('show_zoom_buttons'),
  show_grid_buttons: v.boolean('show_grid_buttons'),
  show_minimap_button: v.boolean('show_minimap_button'),
  show_arrange_button: v.boolean('show_arrange_button'),
});
