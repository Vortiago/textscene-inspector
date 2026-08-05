/**
 * GraphEdit strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { StrictTscnParser } from '../../../../linter/StrictTscnParser';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GraphEdit', property);
  expect(validator, `no validator registered for GraphEdit.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * GraphEdit binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  // Every ADD_PROPERTY GraphEdit binds, graph_edit.cpp:3069-3102, in source
  // order. `clip_contents` and `focus_mode` are Control overrides (the XML marks
  // them `overrides="Control"`), so they stay registered on Control.
  'scroll_offset',
  'show_grid',
  'grid_pattern',
  'snapping_enabled',
  'snapping_distance',
  'panning_scheme',
  'right_disconnects',
  'type_names',
  'connection_lines_curvature',
  'connection_lines_thickness',
  'connection_lines_antialiased',
  'connections',
  'zoom',
  'zoom_min',
  'zoom_max',
  'zoom_step',
  'minimap_enabled',
  'minimap_size',
  'minimap_opacity',
  'show_menu',
  'show_zoom_label',
  'show_zoom_buttons',
  'show_grid_buttons',
  'show_minimap_button',
  'show_arrange_button',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('GraphEdit strict validators', () => {
  it('registers exactly what GraphEdit binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('GraphEdit').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-graph-edit.tscn');
  });

  it('classifies every validator as format-only or grounded, and cites a real line', () => {
    // `boundGrounding.test.ts` owns this repo-wide but needs the barrel, so it
    // cannot run mid-wave. Both hand-rolled validators here are `shape`d and
    // both bounded ones carry a `graph_edit.cpp:<line>` citation; an untagged
    // one would be a bound nobody audited.
    const unclassified = validatorRegistry.getOwnKeys('GraphEdit').filter((property) => {
      const validator = validatorRegistry.findValidator('GraphEdit', property)!;
      return !validator.formatOnly && !validator.grounding;
    });
    expect(unclassified).toEqual([]);

    const groundings = Object.fromEntries(
      validatorRegistry
        .getOwnKeys('GraphEdit')
        .map((property) => [property, validatorRegistry.findValidator('GraphEdit', property)!.grounding])
        .filter(([, grounding]) => grounding !== undefined)
    );
    expect(groundings).toEqual({
      grid_pattern: { kind: 'hinted', cite: 'graph_edit.cpp:3071' },
      panning_scheme: { kind: 'hinted', cite: 'graph_edit.cpp:3074' },
      snapping_distance: { kind: 'enforced', cite: 'graph_edit.cpp:2718' },
      connection_lines_thickness: {
        kind: 'enforced',
        cite: 'graph_edit.cpp:2907, graph_edit.cpp:3081',
      },
      // Two separate guards on one setter: the finite check at :2466 and the
      // std::abs rewrite at :2465, both recorded.
      zoom_step: { kind: 'enforced', cite: 'graph_edit.cpp:2466, graph_edit.cpp:2465' },
    });
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GraphEdit')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

/**
 * Every bare `PropertyInfo(Variant::BOOL, …)` GraphEdit binds. All eleven setters
 * are plain assignments or button-pressed toggles, so `true`/`false` is the whole
 * contract and there is nothing to ground.
 */
const BOOLEANS = [
  'show_grid',
  'snapping_enabled',
  'right_disconnects',
  'connection_lines_antialiased',
  'minimap_enabled',
  'show_menu',
  'show_zoom_label',
  'show_zoom_buttons',
  'show_grid_buttons',
  'show_minimap_button',
  'show_arrange_button',
];

describe.each(BOOLEANS)('GraphEdit.%s', (property) => {
  it('accepts true and false', () => {
    expect(check(property, 'true')).toBeNull();
    expect(check(property, 'false')).toBeNull();
  });

  it('rejects a non-boolean literal', () => {
    const error = check(property, '1');
    expect(error).not.toBeNull();
    expect(error!.message).toContain(property);
  });

  it('rejects capitalised True, which the TSCN grammar does not spell', () => {
    expect(check(property, 'True')).not.toBeNull();
  });
});

describe('GraphEdit.grid_pattern', () => {
  it('accepts both GridPattern members', () => {
    expect(check('grid_pattern', '0')).toBeNull(); // GRID_PATTERN_LINES
    expect(check('grid_pattern', '1')).toBeNull(); // GRID_PATTERN_DOTS
  });

  it('warns rather than errors outside the hint, because the setter assigns through', () => {
    // graph_edit.cpp:3071 hints "Lines,Dots"; set_grid_pattern
    // (graph_edit.cpp:2743-2750) stores whatever int it is handed.
    const error = check('grid_pattern', '2');
    expect(error).not.toBeNull();
    expect(error!.severity).toBe('warning');
  });

  it('warns below the first member too', () => {
    expect(check('grid_pattern', '-1')?.severity).toBe('warning');
  });

  it('rejects a non-integer', () => {
    expect(check('grid_pattern', 'GRID_PATTERN_DOTS')).not.toBeNull();
  });
});

describe('GraphEdit.panning_scheme', () => {
  it('accepts both PanningScheme members', () => {
    expect(check('panning_scheme', '0')).toBeNull(); // SCROLL_ZOOMS
    expect(check('panning_scheme', '1')).toBeNull(); // SCROLL_PANS
  });

  it('warns rather than errors outside the hint', () => {
    // graph_edit.cpp:3074 hints "Scroll Zooms,Scroll Pans"; set_panning_scheme
    // (graph_edit.cpp:2418-2421) casts the int straight into the panner.
    expect(check('panning_scheme', '2')?.severity).toBe('warning');
  });

  it('accepts a float literal, which Godot truncates into the int property', () => {
    // Variant's FLOAT -> int conversion is a C cast, `return T(_data._float);`
    // (core/variant/variant.h:369-370), so `0.5` loads as SCROLL_ZOOMS rather
    // than failing. Rejecting it would refuse a file the engine reads.
    expect(check('panning_scheme', '0.5')).toBeNull();
  });

  it('rejects a non-numeric token', () => {
    expect(check('panning_scheme', 'SCROLL_PANS')).not.toBeNull();
  });
});

describe('GraphEdit.snapping_distance', () => {
  it('accepts the default and both inclusive extremes', () => {
    // GRID_MIN_SNAPPING_DISTANCE = 2 (graph_edit.cpp:57),
    // GRID_MAX_SNAPPING_DISTANCE = 100 (graph_edit.cpp:58).
    expect(check('snapping_distance', '20')).toBeNull();
    expect(check('snapping_distance', '2')).toBeNull();
    expect(check('snapping_distance', '100')).toBeNull();
  });

  it('errors below 2, which the setter refuses outright', () => {
    // graph_edit.cpp:2718 ERR_FAIL_COND_MSG, so the write never lands.
    const error = check('snapping_distance', '1');
    expect(error).not.toBeNull();
    expect(error!.severity).toBe('error');
  });

  it('errors above 100 for the same reason', () => {
    expect(check('snapping_distance', '101')?.severity).toBe('error');
  });

  it('rejects a non-numeric value', () => {
    expect(check('snapping_distance', 'twenty')).not.toBeNull();
  });
});

describe('GraphEdit.connection_lines_thickness', () => {
  it('accepts the default and both ends of the hint', () => {
    expect(check('connection_lines_thickness', '4.0')).toBeNull();
    expect(check('connection_lines_thickness', '0')).toBeNull();
    expect(check('connection_lines_thickness', '100')).toBeNull();
  });

  it('errors below 0, where the setter ERR_FAILs', () => {
    // graph_edit.cpp:2907: ERR_FAIL_COND_MSG(p_thickness < 0, …).
    const error = check('connection_lines_thickness', '-0.5');
    expect(error).not.toBeNull();
    expect(error!.severity).toBe('error');
  });

  it('only warns above 100, where nothing but the inspector hint objects', () => {
    // graph_edit.cpp:3081 hints "0,100,0.1,suffix:px" with no `or_greater`, but
    // the setter assigns 250 straight through and the line is drawn that thick.
    expect(check('connection_lines_thickness', '250')?.severity).toBe('warning');
  });
});

/**
 * The FLOAT properties Godot binds with PROPERTY_HINT_NONE and assigns through:
 * `connection_lines_curvature` (graph_edit.cpp:3080), `minimap_opacity`
 * (graph_edit.cpp:3094), and the three zoom levels (graph_edit.cpp:3086-3088).
 * Godot states no static bound for any of them, so neither does the validator.
 */
const UNBOUNDED_FLOATS = [
  'connection_lines_curvature',
  'minimap_opacity',
  'zoom',
  'zoom_min',
  'zoom_max',
];

describe.each(UNBOUNDED_FLOATS)('GraphEdit.%s', (property) => {
  it('accepts an ordinary float', () => {
    expect(check(property, '0.5')).toBeNull();
  });

  it('accepts a value no hint permits, because no hint exists', () => {
    expect(check(property, '12.75')).toBeNull();
    expect(check(property, '-3')).toBeNull();
  });

  it('rejects a non-numeric value', () => {
    expect(check(property, 'half')).not.toBeNull();
  });
});

describe('GraphEdit.zoom_step', () => {
  it('accepts the default and zero', () => {
    expect(check('zoom_step', '1.2')).toBeNull();
    expect(check('zoom_step', '0')).toBeNull();
  });

  it('errors on a negative step, which the setter rewrites rather than keeps', () => {
    // graph_edit.cpp:2465: `p_zoom_step = std::abs(p_zoom_step);`, so the scene
    // says -1.2 and the engine zooms by 1.2, so the authored value is altered.
    const error = check('zoom_step', '-1.2');
    expect(error).not.toBeNull();
    expect(error!.severity).toBe('error');
  });

  it('rejects a non-numeric value', () => {
    expect(check('zoom_step', 'double')).not.toBeNull();
  });
});

describe.each(['scroll_offset', 'minimap_size'])('GraphEdit.%s', (property) => {
  it('accepts a Vector2 literal', () => {
    expect(check(property, 'Vector2(240, 160)')).toBeNull();
  });

  it('accepts negative and fractional components', () => {
    // scroll_offset is routinely negative; both setters clamp against sizes
    // known only at runtime (graph_edit.cpp:407 clamps to
    // [min_scroll_offset, max_scroll_offset - get_size()], and
    // graph_edit.cpp:2771 hands the size to Control::set_size, which raises it
    // to the minimum size), so no static component bound exists.
    expect(check(property, 'Vector2(-128.5, -4)')).toBeNull();
  });

  it('rejects a scalar where a Vector2 belongs', () => {
    expect(check(property, '240')).not.toBeNull();
  });

  it('rejects a Vector2 with the wrong component count', () => {
    expect(check(property, 'Vector2(1, 2, 3)')).not.toBeNull();
  });
});

describe('GraphEdit.connections', () => {
  it('accepts the empty array Godot writes for the default', () => {
    expect(check('connections', '[]')).toBeNull();
  });

  it('accepts the typed wrapper the getter forces', () => {
    // The ADD_PROPERTY declares Variant::ARRAY (graph_edit.cpp:3083) but the
    // getter returns TypedArray<Dictionary> (graph_edit.h:355), and
    // Array::is_typed() makes the writer emit the `Array[Type](…)` wrapper
    // (core/variant/variant_parser.cpp:2341-2344). Rejecting this shape would
    // reject a file Godot itself saved.
    expect(
      check(
        'connections',
        'Array[Dictionary]([{ "from_node": &"A", "from_port": 0, "to_node": &"B", "to_port": 0, "keep_alive": true }])'
      )
    ).toBeNull();
  });

  it('accepts the bare untyped array, which the TypedArray constructor assigns', () => {
    // TypedArray<T>(const Array &) calls assign() (core/variant/typed_array.h:43-50),
    // so an untyped `[…]` loads into the typed property.
    expect(check('connections', '[{ "from_node": &"A", "from_port": 0 }]')).toBeNull();
  });

  it('rejects a value that is not an array literal', () => {
    expect(check('connections', 'PackedStringArray("A", "B")')).not.toBeNull();
  });

  it('rejects an unterminated array', () => {
    expect(check('connections', '[{ "from_node": &"A" }')).not.toBeNull();
  });
});

describe('GraphEdit.type_names', () => {
  it('accepts the empty dictionary Godot writes for the default', () => {
    expect(check('type_names', '{}')).toBeNull();
  });

  it('accepts a populated dictionary literal', () => {
    // The member is a plain `Dictionary` (graph_edit.h:314) and the getter
    // returns it untyped (graph_edit.h:434), so no `Dictionary[int, String](…)`
    // wrapper is ever written despite PROPERTY_HINT_DICTIONARY_TYPE.
    expect(check('type_names', '{ 0: "Number", 1: "Text" }')).toBeNull();
  });

  it('rejects a value that is not a dictionary literal', () => {
    expect(check('type_names', '[0, "Number"]')).not.toBeNull();
  });

  it('rejects an unterminated dictionary', () => {
    expect(check('type_names', '{ 0: "Number"')).not.toBeNull();
  });
});

describe('GraphEdit fixture reachability', () => {
  it('actually validates the single-line dictionary and array the fixture uses', () => {
    // StrictTscnParser skips multi-line values outright, and Godot's own writer
    // WRAPS a populated Dictionary or Array across several lines. The fixture
    // therefore keeps `type_names` and `connections` on one line each, which is
    // only worth doing if a bad one-line value really is reported. Proving that
    // here stops the fixture's "zero diagnostics" claim from being vacuous.
    const content =
      `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n` +
      `[node name="MyGraphEdit" type="GraphEdit" parent="."]\n` +
      `type_names = <0: "Number">\n` +
      `connections = PackedStringArray("A")\n`;
    const codes = new StrictTscnParser().parse(content).errors.map((error) => error.code);
    expect(codes).toContain('INVALID_TYPE_NAMES_FORMAT');
    expect(codes).toContain('INVALID_CONNECTIONS_FORMAT');
  });

  it('sees nothing on the wrapped form Godot writes, which is why the fixture avoids it', () => {
    const content =
      `[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n` +
      `[node name="MyGraphEdit" type="GraphEdit" parent="."]\n` +
      `type_names = {\n0: "Number",\n1: "Text"\n}\n`;
    expect(new StrictTscnParser().parse(content).errors).toEqual([]);
  });
});
