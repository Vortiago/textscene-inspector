/**
 * Tests for TileMap strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

function errorsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('TileMap strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a valid TileMap with a transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMap"]
transform = Transform2D(1, 0, 0, 1, 0, 0)
`;

    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed transform', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMap"]
transform = Transform2D(nope)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('transform');
  });

  it('rejects a malformed tile_set reference', () => {
    const content = `[gd_scene format=3]

[node name="X" type="TileMap"]
tile_set = NotARef(1)
`;

    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('tile_set');
  });

  describe('layer_<i>/*', () => {
    function check(key: string, value: string) {
      const validator = validatorRegistry.findValidator('TileMap', key);
      expect(validator, `no validator resolved for TileMap.${key}`).not.toBeNull();
      return validator!(key, value, 1);
    }

    it('accepts a quoted layer name', () => {
      expect(check('layer_0/name', '"Ground"')).toBeNull();
    });

    it('accepts enabled/y_sort_enabled/navigation_enabled booleans', () => {
      expect(check('layer_0/enabled', 'true')).toBeNull();
      expect(check('layer_0/y_sort_enabled', 'false')).toBeNull();
      expect(check('layer_0/navigation_enabled', 'true')).toBeNull();
    });

    it('accepts a Color modulate', () => {
      expect(check('layer_0/modulate', 'Color(1, 1, 1, 1)')).toBeNull();
    });

    it('accepts an unbounded y_sort_origin', () => {
      expect(check('layer_0/y_sort_origin', '-9999')).toBeNull();
    });

    it('accepts z_index within CanvasItem\'s enforced range', () => {
      expect(check('layer_1/z_index', '1')).toBeNull();
      expect(check('layer_1/z_index', '-4096')).toBeNull();
      expect(check('layer_1/z_index', '4096')).toBeNull();
    });

    it('errors on z_index outside the enforced range (canvas_item.cpp:668)', () => {
      const error = check('layer_1/z_index', '4097');
      expect(error?.severity).toBe('error');
    });

    it('accepts a PackedInt32Array tile_data literal', () => {
      expect(check('layer_0/tile_data', 'PackedInt32Array(0, 0, 0, 1, 65536, 0)')).toBeNull();
    });

    it('rejects a malformed tile_data literal', () => {
      expect(check('layer_0/tile_data', '"nope"')?.code).toBe('INVALID_TILE_DATA_FORMAT');
    });

    it('rejects an unrecognised leaf', () => {
      const error = check('layer_0/not_a_real_leaf', '1');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_TILEMAP_LAYER_KEY');
    });

    it('rejects a negative layer index (property_list_helper.cpp:58)', () => {
      const error = check('layer_-1/name', '"X"');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_TILEMAP_LAYER_INDEX');
    });
  });
});
