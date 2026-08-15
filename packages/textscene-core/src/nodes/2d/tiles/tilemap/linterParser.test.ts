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

describe('tile_data with an element no int32 holds', () => {
  it('errors, where the grammar alone was silent', () => {
    const v = validatorRegistry.findValidator('TileMap', 'layer_0/tile_data')!;
    expect(v('layer_0/tile_data', 'PackedInt32Array(inf, 0, 0)', 1)?.severity).toBe('error');
    expect(v('layer_0/tile_data', 'PackedInt32Array(0, 0, 0)', 1)).toBeNull();
  });
});

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

  function checkTopLevel(key: string, value: string) {
    const validator = validatorRegistry.findValidator('TileMap', key);
    expect(validator, `no validator resolved for TileMap.${key}`).not.toBeNull();
    return validator!(key, value, 1);
  }

  describe('collision_animatable — bare assignment (tile_map.cpp:401-410), no ERR_FAIL, no hint, so no bound', () => {
    it('accepts true/false', () => {
      expect(checkTopLevel('collision_animatable', 'true')).toBeNull();
      expect(checkTopLevel('collision_animatable', 'false')).toBeNull();
    });

    it('rejects a non-boolean — the property is Variant::BOOL', () => {
      expect(checkTopLevel('collision_animatable', '1')).not.toBeNull();
    });
  });

  describe('collision_visibility_mode — bare assignment (tile_map.cpp:417-426), PROPERTY_HINT_ENUM "Default,Force Show,Force Hide" at tile_map.cpp:998', () => {
    it('accepts the exact value scenes/demos/2d/physics_tests writes (1=FORCE_SHOW) and the enum floor/ceiling', () => {
      expect(checkTopLevel('collision_visibility_mode', '1')).toBeNull();
      expect(checkTopLevel('collision_visibility_mode', '0')).toBeNull();
      expect(checkTopLevel('collision_visibility_mode', '2')).toBeNull();
    });

    it('warns below 0, the first value outside the hint — the setter forwards it to every layer unaltered', () => {
      const error = checkTopLevel('collision_visibility_mode', '-1');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });

    it('warns above 2, the first value outside the hint', () => {
      const error = checkTopLevel('collision_visibility_mode', '3');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });
  });

  describe('navigation_visibility_mode — bare assignment (tile_map.cpp:433-442), PROPERTY_HINT_ENUM "Default,Force Show,Force Hide" at tile_map.cpp:1000', () => {
    it('accepts the enum floor (0=DEFAULT) and ceiling (2=FORCE_HIDE)', () => {
      expect(checkTopLevel('navigation_visibility_mode', '0')).toBeNull();
      expect(checkTopLevel('navigation_visibility_mode', '1')).toBeNull();
      expect(checkTopLevel('navigation_visibility_mode', '2')).toBeNull();
    });

    it('warns below 0, the first value outside the hint', () => {
      const error = checkTopLevel('navigation_visibility_mode', '-1');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });

    it('warns above 2, the first value outside the hint', () => {
      const error = checkTopLevel('navigation_visibility_mode', '3');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });
  });

  describe('rendering_quadrant_size — ERR_FAIL_COND_MSG(p_size < 1) at tile_map.cpp:224, PROPERTY_HINT_RANGE "1,128,1" at tile_map.cpp:996', () => {
    it('accepts the exact values scenes/demos/2d writes (4 and 32), both inside the hinted range', () => {
      expect(checkTopLevel('rendering_quadrant_size', '4')).toBeNull();
      expect(checkTopLevel('rendering_quadrant_size', '32')).toBeNull();
    });

    it('accepts the enforced floor (1) and the hinted ceiling (128)', () => {
      expect(checkTopLevel('rendering_quadrant_size', '1')).toBeNull();
      expect(checkTopLevel('rendering_quadrant_size', '128')).toBeNull();
    });

    it('errors at 0, the first value the ERR_FAIL_COND_MSG floor refuses', () => {
      const error = checkTopLevel('rendering_quadrant_size', '0');
      expect(error?.severity).toBe('error');
    });

    it('warns above the hinted 128 ceiling — the setter never checks it (tile_map.cpp:996), unlike TileMapLayer\'s own rendering_quadrant_size which has no ceiling at all', () => {
      const error = checkTopLevel('rendering_quadrant_size', '129');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
    });
  });
});
