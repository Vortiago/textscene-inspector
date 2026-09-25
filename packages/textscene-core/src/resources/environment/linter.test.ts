/**
 * Environment linter validator tests - tests validators directly
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry';
import './linterValidators'; // Import to trigger registration

describe('Environment Linter Validators', () => {
  describe('background_mode validator', () => {
    it('should accept valid modes 0-5', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      expect(validator).not.toBeNull();

      for (let mode = 0; mode <= 5; mode++) {
        const result = validator!('background_mode', mode.toString(), 1);
        expect(result).toBeNull();
      }
    });

    it('should warn on invalid mode 99', () => {
      // environment.cpp:1237, set_background (:43-49) is a bare assignment: no
      // ERR_FAIL_INDEX, so out-of-range is a warning, not an error (ADR-0032).
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      const result = validator!('background_mode', '99', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.message).toContain('must be 0-5 (got 99)');
      // The combinators name Godot's own constants rather than printing a bare range.
      expect(result!.message).toContain('0=BG_CLEAR_COLOR');
      expect(result!.code).toBe('INVALID_BACKGROUND_MODE_VALUE');
    });

    it('should warn on negative mode', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      const result = validator!('background_mode', '-1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });

    it('should reject non-numeric mode', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_mode');
      const result = validator!('background_mode', 'invalid', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('background_color validator', () => {
    it('should accept valid Color format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      expect(validator).not.toBeNull();

      const result = validator!('background_color', 'Color(0.15, 0.12, 0.1, 1)', 1);
      expect(result).toBeNull();
    });

    it('should accept Color with spaces', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'Color( 0.8 , 0.8 , 0.9 , 1 )', 1);
      expect(result).toBeNull();
    });

    it('should reject Color with missing alpha', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'Color(1, 2, 3)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('Color with 4 numbers like Color(1, 1, 1, 1)');
      expect(result!.code).toBe('INVALID_BACKGROUND_COLOR_FORMAT');
    });

    it('should reject Color with too many components', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'Color(1,2,3,4,5)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject invalid format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'NotAColor', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('should reject rgb format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'background_color');
      const result = validator!('background_color', 'rgb(1, 2, 3)', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('volumetric_fog_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      expect(validator).not.toBeNull();

      const result = validator!('volumetric_fog_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      const result = validator!('volumetric_fog_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject "maybe"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      const result = validator!('volumetric_fog_enabled', 'maybe', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.message).toContain('must be a boolean (true or false)');
      expect(result!.code).toBe('INVALID_VOLUMETRIC_FOG_ENABLED_FORMAT');
    });

    it('should reject numeric value', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_enabled');
      const result = validator!('volumetric_fog_enabled', '1', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('volumetric_fog_density validator', () => {
    it('should accept positive density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      expect(validator).not.toBeNull();

      const result = validator!('volumetric_fog_density', '0.001', 1);
      expect(result).toBeNull();
    });

    it('should accept zero density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      const result = validator!('volumetric_fog_density', '0', 1);
      expect(result).toBeNull();
    });

    it('should warn on negative density', () => {
      // environment.cpp:1536 ("0,1,0.0001,or_greater"), set_volumetric_fog_density
      // (:939-942) is a bare assignment: warning, not error (ADR-0032).
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      const result = validator!('volumetric_fog_density', '-0.5', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.message).toContain('must be non-negative');
      expect(result!.code).toBe('INVALID_VOLUMETRIC_FOG_DENSITY_VALUE');
    });

    it('should reject non-numeric density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_density');
      const result = validator!('volumetric_fog_density', 'invalid', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('volumetric_fog_albedo validator', () => {
    it('should accept valid Color format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_albedo');
      expect(validator).not.toBeNull();

      const result = validator!('volumetric_fog_albedo', 'Color(0.8, 0.8, 0.9, 1)', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid Color format', () => {
      const validator = validatorRegistry.findValidator('Environment', 'volumetric_fog_albedo');
      const result = validator!('volumetric_fog_albedo', 'NotAColor', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('adjustment_brightness validator', () => {
    it('should accept positive brightness', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_brightness');
      expect(validator).not.toBeNull();

      const result = validator!('adjustment_brightness', '1.05', 1);
      expect(result).toBeNull();
    });

    it('should accept zero brightness', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_brightness');
      const result = validator!('adjustment_brightness', '0', 1);
      expect(result).toBeNull();
    });

    it('should warn on negative brightness', () => {
      // environment.cpp:1565 ("0.0,2.0,0.01,or_greater"), set_adjustment_brightness
      // (:1041-1044) is a bare assignment: warning, not error (ADR-0032).
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_brightness');
      const result = validator!('adjustment_brightness', '-0.5', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.message).toContain('must be non-negative');
      expect(result!.code).toBe('INVALID_ADJUSTMENT_BRIGHTNESS_VALUE');
    });
  });

  describe('adjustment_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_enabled');
      const result = validator!('adjustment_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_enabled');
      const result = validator!('adjustment_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('Environment', 'adjustment_enabled');
      const result = validator!('adjustment_enabled', 'yes', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('ssr_enabled validator', () => {
    it('should accept "true"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ssr_enabled');
      const result = validator!('ssr_enabled', 'true', 1);
      expect(result).toBeNull();
    });

    it('should accept "false"', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ssr_enabled');
      const result = validator!('ssr_enabled', 'false', 1);
      expect(result).toBeNull();
    });

    it('should reject invalid boolean', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ssr_enabled');
      const result = validator!('ssr_enabled', 'on', 1);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('ambient_light_source validator', () => {
    it('should accept sources 0-3', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ambient_light_source');
      expect(validator).not.toBeNull();
      for (let s = 0; s <= 3; s++) {
        expect(validator!('ambient_light_source', String(s), 1)).toBeNull();
      }
    });

    it('should warn on source 4', () => {
      // environment.cpp:1264, set_ambient_source (:151-155) is a bare assignment.
      const validator = validatorRegistry.findValidator('Environment', 'ambient_light_source');
      const result = validator!('ambient_light_source', '4', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('ambient_light_color validator', () => {
    it('should accept valid Color', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ambient_light_color');
      expect(validator!('ambient_light_color', 'Color(0.3, 0.3, 0.3, 1)', 1)).toBeNull();
    });

    it('should reject garbage', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ambient_light_color');
      expect(validator!('ambient_light_color', 'nope', 1)).not.toBeNull();
    });
  });

  describe('ambient_light_energy validator', () => {
    it('should accept non-negative', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ambient_light_energy');
      expect(validator!('ambient_light_energy', '2.0', 1)).toBeNull();
    });

    it('should reject negative', () => {
      const validator = validatorRegistry.findValidator('Environment', 'ambient_light_energy');
      expect(validator!('ambient_light_energy', '-1', 1)).not.toBeNull();
    });
  });

  describe('fog_enabled validator', () => {
    it('should accept boolean', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_enabled');
      expect(validator!('fog_enabled', 'true', 1)).toBeNull();
    });

    it('should reject non-boolean', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_enabled');
      expect(validator!('fog_enabled', '1', 1)).not.toBeNull();
    });
  });

  describe('fog_density validator', () => {
    it('should accept non-negative density', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_density');
      expect(validator!('fog_density', '0.02', 1)).toBeNull();
    });

    it('should warn on negative density (the witnessed fog_density = -5)', () => {
      // environment.cpp:1497 ("0,1,0.0001,or_greater"), set_fog_density (:814-817)
      // is a bare assignment: warning, not error (ADR-0032).
      const validator = validatorRegistry.findValidator('Environment', 'fog_density');
      const result = validator!('fog_density', '-5', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('fog_light_color validator', () => {
    it('should accept valid Color', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_light_color');
      expect(validator!('fog_light_color', 'Color(0.5, 0.6, 0.7, 1)', 1)).toBeNull();
    });

    it('should reject malformed Color (the witnessed Color(oops))', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_light_color');
      const result = validator!('fog_light_color', 'Color(oops)', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('fog_mode validator', () => {
    it('should accept 0 (EXPONENTIAL) and 1 (DEPTH)', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_mode');
      expect(validator!('fog_mode', '0', 1)).toBeNull();
      expect(validator!('fog_mode', '1', 1)).toBeNull();
    });

    it('should reject 2', () => {
      const validator = validatorRegistry.findValidator('Environment', 'fog_mode');
      expect(validator!('fog_mode', '2', 1)).not.toBeNull();
    });
  });

  describe('tonemap_mode validator', () => {
    it('should accept modes 0-4', () => {
      const validator = validatorRegistry.findValidator('Environment', 'tonemap_mode');
      expect(validator).not.toBeNull();
      for (let m = 0; m <= 4; m++) {
        expect(validator!('tonemap_mode', String(m), 1)).toBeNull();
      }
    });

    it('should warn on mode 5', () => {
      // environment.cpp:1286, set_tonemapper (:202-206) is a bare assignment.
      const validator = validatorRegistry.findValidator('Environment', 'tonemap_mode');
      const result = validator!('tonemap_mode', '5', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });

    it('should reject non-numeric mode', () => {
      const validator = validatorRegistry.findValidator('Environment', 'tonemap_mode');
      expect(validator!('tonemap_mode', 'filmic', 1)).not.toBeNull();
    });
  });

  describe('tonemap_white / tonemap_exposure validators', () => {
    it('should accept non-negative values (witnessed white = 6.0)', () => {
      const white = validatorRegistry.findValidator('Environment', 'tonemap_white');
      const exposure = validatorRegistry.findValidator('Environment', 'tonemap_exposure');
      expect(white!('tonemap_white', '6.0', 1)).toBeNull();
      expect(exposure!('tonemap_exposure', '1.3', 1)).toBeNull();
    });

    it('should reject negative values', () => {
      const white = validatorRegistry.findValidator('Environment', 'tonemap_white');
      expect(white!('tonemap_white', '-1', 1)).not.toBeNull();
    });

    it('validates AgX’s separate white, which AGX reads instead of tonemap_white', () => {
      const agxWhite = validatorRegistry.findValidator('Environment', 'tonemap_agx_white');
      expect(agxWhite).not.toBeNull();
      expect(agxWhite!('tonemap_agx_white', '16.29', 1)).toBeNull();
      expect(agxWhite!('tonemap_agx_white', 'bright', 1)).not.toBeNull();
    });
  });

  describe('sky validator', () => {
    it('should accept a SubResource reference', () => {
      const validator = validatorRegistry.findValidator('Environment', 'sky');
      expect(validator).not.toBeNull();
      expect(validator!('sky', 'SubResource("Sky_lexvt")', 1)).toBeNull();
    });

    it('should reject a non-reference value', () => {
      const validator = validatorRegistry.findValidator('Environment', 'sky');
      const result = validator!('sky', 'blue', 1);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });
});

describe('index.linter entry point', () => {
  it('registers the same validators when imported through the slice entry point', async () => {
    // The barrel wires `index.linter.ts`, not the implementation module. Both reach
    // the same `registerAll`, which merges rather than replaces, so importing both
    // paths registers nothing twice.
    await import('./index.linter');
    const validator = validatorRegistry.findValidator('Environment', 'glow_blend_mode');
    expect(validator).not.toBeNull();
    expect(validator!('glow_blend_mode', '2', 1)).toBeNull();
    expect(validator!('glow_blend_mode', '9', 1)).not.toBeNull();
  });
});
