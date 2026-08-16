/**
 * Tests for TileMapLayer strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TileMapLayer', property);
  expect(validator, `no validator registered for TileMapLayer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('TileMapLayer strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid TileMapLayer with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMapLayer"]
transform = Transform2D(1, 0, 0, 1, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMapLayer"]
transform = Transform2D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('rejects a malformed tile_set reference', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMapLayer"]
tile_set = NotARef(1)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('tile_set');
  });

  describe('tile_map_data — PACKED_BYTE_ARRAY, PROPERTY_HINT_NONE (tile_map_layer.cpp:2267)', () => {
    it('accepts an empty PackedByteArray, the zero-cell spelling', () => {
      expect(check('tile_map_data', 'PackedByteArray()')).toBeNull();
    });

    it('accepts the exact decimal-byte value scenes/fixtures/unit-tile-map-layer-hexagon.tscn writes', () => {
      // resource_format_text.cpp writes decimal bytes when the file's
      // PackedByteArrays stay under the 64-byte compat threshold.
      const real =
        'PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0)';
      expect(check('tile_map_data', real)).toBeNull();
    });

    it('accepts the exact base64 value scenes/demos/2d/dynamic_tilemap_layers/world.tscn writes', () => {
      // resource_format_text.cpp:1724-1728 switches the WHOLE FILE to base64
      // once any PackedByteArray in it exceeds 64 bytes — the spelling every
      // Godot-exported demo in this corpus actually carries.
      const real =
        'PackedByteArray("AAAOABoAAAAAAAAAAAAOABsAAAAAAAAAAAAOABwAAAAAAAAAAAAPABoAAAAAAAAAAAAPABsAAAAAAAAAAAAPABwAAAAAAAAAAAAQABoAAAAAAAAAAAAQABsAAAAAAAAAAAAQABwAAAAAAAAAAAARABoAAAAAAAAAAAARABsAAAAAAAAAAAARABwAAAAAAAAAAAASABoAAAAAAAAAAAASABsAAAAAAAAAAAASABwAAAAAAAAAAAATABoAAAAAAAAAAAATABsAAAAAAAAAAAATABwAAAAAAAAAAAAUABoAAAAAAAAAAAAUABsAAAAAAAAAAAAUABwAAAAAAAAAAAA=")';
      expect(check('tile_map_data', real)).toBeNull();
    });

    it('rejects a value that is not the PackedByteArray(…) grammar at all — _parse_byte_array requires the "(" token (variant_parser.cpp:603)', () => {
      expect(check('tile_map_data', '"nope"')?.code).toBe('INVALID_TILE_MAP_DATA_FORMAT');
    });

    it('rejects a decimal list with a non-integer entry — _parse_byte_array requires TK_NUMBER (variant_parser.cpp:631-647)', () => {
      expect(check('tile_map_data', 'PackedByteArray(0, abc, 0)')?.code).toBe(
        'INVALID_TILE_MAP_DATA_FORMAT'
      );
    });

    it('rejects a quoted string with non-base64 characters — CryptoCore::b64_decode fails the parse (variant_parser.cpp:618-622)', () => {
      expect(check('tile_map_data', 'PackedByteArray("not valid base64!!!")')?.code).toBe(
        'INVALID_TILE_MAP_DATA_FORMAT'
      );
    });
  });

  describe('bare-assignment booleans — no ERR_FAIL, no PROPERTY_HINT_RANGE, so no bound in either direction', () => {
    // Godot omits every one of these at its default value (all default
    // true/false and are simply absent from a scene that never overrides
    // them), so the corpus carries zero real occurrences to pin against —
    // confirmed by grepping scenes/**/*.tscn for each key.
    // The grounding differs per row and stays a column: four cite a
    // bare-assignment setter, while navigation_enabled's PROPERTY_HINT_GROUP_ENABLE
    // only makes the inspector group checkable and adds no value constraint.
    it.each([
      ['occlusion_enabled', 'bare assignment (tile_map_layer.cpp:3442-3450)'],
      ['x_draw_order_reversed', 'bare assignment (tile_map_layer.cpp:3335-3343)'],
      ['collision_enabled', 'bare assignment (tile_map_layer.cpp:3384-3392)'],
      ['use_kinematic_bodies', 'bare assignment (tile_map_layer.cpp:3398-3406)'],
      ['navigation_enabled', 'PROPERTY_HINT_GROUP_ENABLE (tile_map_layer.cpp:2283)'],
    ])('%s: accepts true/false and nothing else — %s', (property) => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
      expect(check(property, '1')).not.toBeNull();
    });
  });

  describe('y_sort_origin — bare assignment past an equality early-out (tile_map_layer.cpp:3321-3329), PROPERTY_HINT_NONE with no suffix at all', () => {
    it('accepts the exact value scenes/isometric/dungeon.tscn writes (32) and its negation, both unbounded', () => {
      expect(check('y_sort_origin', '32')).toBeNull();
      expect(check('y_sort_origin', '-9999')).toBeNull();
      expect(check('y_sort_origin', '9999')).toBeNull();
    });

    it('rejects a non-integer — the property is Variant::INT, not FLOAT', () => {
      expect(check('y_sort_origin', '1.5')).not.toBeNull();
    });
  });

  describe('rendering_quadrant_size — ERR_FAIL_COND_MSG(p_size < 1) at tile_map_layer.cpp:3373; hint is PROPERTY_HINT_NONE (:2275), unlike TileMap\'s own property', () => {
    it('accepts the floor value 1', () => {
      expect(check('rendering_quadrant_size', '1')).toBeNull();
    });

    it('errors at 0, the first value the ERR_FAIL_COND_MSG floor refuses', () => {
      const error = check('rendering_quadrant_size', '0');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });

    it('accepts an arbitrarily large size — no RANGE hint means no ceiling at all, unlike TileMap\'s hinted 128 (tile_map.cpp:996)', () => {
      expect(check('rendering_quadrant_size', '999999')).toBeNull();
    });
  });

  describe('physics_quadrant_size — ERR_FAIL_COND_MSG(p_size < 1) at tile_map_layer.cpp:3430; hint is PROPERTY_HINT_NONE (:2280)', () => {
    it('accepts the floor value 1', () => {
      expect(check('physics_quadrant_size', '1')).toBeNull();
    });

    it('errors at 0, the first value the ERR_FAIL_COND_MSG floor refuses', () => {
      const error = check('physics_quadrant_size', '0');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });

    it('accepts an arbitrarily large size — no RANGE hint means no ceiling', () => {
      expect(check('physics_quadrant_size', '999999')).toBeNull();
    });
  });

  describe('collision_visibility_mode — bare assignment (tile_map_layer.cpp:3412-3420), PROPERTY_HINT_ENUM "Default,Force Show,Force Hide" at :2279', () => {
    it('accepts the enum floor (0=DEFAULT) and ceiling (2=FORCE_HIDE)', () => {
      expect(check('collision_visibility_mode', '0')).toBeNull();
      expect(check('collision_visibility_mode', '1')).toBeNull();
      expect(check('collision_visibility_mode', '2')).toBeNull();
    });

    it('warns below 0, the first value outside the hint — hint constrains the inspector widget, not the setter', () => {
      const error = check('collision_visibility_mode', '-1');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });

    it('warns above 2, the first value outside the hint', () => {
      const error = check('collision_visibility_mode', '3');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });
  });

  describe('navigation_visibility_mode — bare assignment (tile_map_layer.cpp:3490-3498), PROPERTY_HINT_ENUM "Default,Force Show,Force Hide" at :2284', () => {
    it('accepts the enum floor (0=DEFAULT) and ceiling (2=FORCE_HIDE)', () => {
      expect(check('navigation_visibility_mode', '0')).toBeNull();
      expect(check('navigation_visibility_mode', '1')).toBeNull();
      expect(check('navigation_visibility_mode', '2')).toBeNull();
    });

    it('warns below 0, the first value outside the hint', () => {
      const error = check('navigation_visibility_mode', '-1');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });

    it('warns above 2, the first value outside the hint', () => {
      const error = check('navigation_visibility_mode', '3');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });
  });
});

describe('tile_map_data element storage', () => {
  const validator = validatorRegistry.findValidator('TileMapLayer', 'tile_map_data')!;

  it('reports an element no integer slot can hold', () => {
    // The seventh hand-rolled packed-int validator, and the only one not on
    // `badIntElement`: it checked the FLOAT grammar, so a legal literal the
    // slot cannot carry passed while the decoder silently dropped the layer.
    expect(validator('tile_map_data', 'PackedByteArray(1e20, 0, 0)', 1)).not.toBeNull();
    expect(validator('tile_map_data', 'PackedByteArray(inf, 0, 0)', 1)).not.toBeNull();
  });

  it('is tagged as the int slot it reads, so the sweep sees it', () => {
    expect(validator.intSlot).toBeDefined();
  });

  it('still accepts the bodies Godot writes', () => {
    expect(validator('tile_map_data', 'PackedByteArray(0, 0, 9, 0)', 1)).toBeNull();
    expect(validator('tile_map_data', 'PackedByteArray("AAAJAAsAAgABAAAABQA=")', 1)).toBeNull();
  });
});
