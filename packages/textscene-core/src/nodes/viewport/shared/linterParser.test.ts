/**
 * The Viewport-level validators must reach BOTH instantiable Viewports.
 *
 * They used to be registered on `SubViewport` alone, so when `Window` arrived
 * it inherited none of them: the same property on the same base class errored
 * on one node type and was silently accepted on the other. These assertions
 * pin the shared registration and the two base-walk links that deliver it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** Every member `doc/classes/Viewport.xml` owns that this repo validates. */
const VIEWPORT_KEYS = [
  'own_world_3d',
  'disable_3d',
  'transparent_bg',
  'handle_input_locally',
  'use_debanding',
  'audio_listener_enable_2d',
  'gui_embed_subwindows',
  'msaa_3d',
  'canvas_item_default_texture_filter',
  'use_xr',
  'snap_2d_transforms_to_pixel',
  'snap_2d_vertices_to_pixel',
  'msaa_2d',
  'screen_space_aa',
  'use_taa',
  'use_occlusion_culling',
  'mesh_lod_threshold',
  'debug_draw',
  'use_hdr_2d',
  'scaling_3d_mode',
  'scaling_3d_scale',
  'texture_mipmap_bias',
  'anisotropic_filtering_level',
  'fsr_sharpness',
  'vrs_mode',
  'vrs_update_mode',
  'vrs_texture',
  'canvas_item_default_texture_repeat',
  'audio_listener_enable_3d',
  'physics_object_picking',
  'physics_object_picking_sort',
  'physics_object_picking_first_only',
  'gui_disable_input',
  'gui_snap_controls_to_pixels',
  'gui_drag_threshold',
  'sdf_oversize',
  'sdf_scale',
  'positional_shadow_atlas_size',
  'positional_shadow_atlas_16_bits',
  'positional_shadow_atlas_quad_0',
  'positional_shadow_atlas_quad_1',
  'positional_shadow_atlas_quad_2',
  'positional_shadow_atlas_quad_3',
  'canvas_cull_mask',
  'oversampling',
  'oversampling_override',
  'world_3d',
] as const;

/** Bare bool assigns: `true`/`false` in, anything else out. No range to ground. */
const BOOLEAN_KEYS = [
  'use_xr',
  'snap_2d_transforms_to_pixel',
  'snap_2d_vertices_to_pixel',
  'use_taa',
  'use_occlusion_culling',
  'use_hdr_2d',
  'audio_listener_enable_3d',
  'physics_object_picking',
  'physics_object_picking_sort',
  'physics_object_picking_first_only',
  'gui_disable_input',
  'gui_snap_controls_to_pixels',
  'positional_shadow_atlas_16_bits',
  'oversampling',
] as const;

describe('Viewport shared validators', () => {
  it('registers under the abstract Viewport key', () => {
    expect(validatorRegistry.getOwnKeys('Viewport').sort()).toEqual([...VIEWPORT_KEYS].sort());
  });

  it.each(['SubViewport', 'Window'])('delivers every Viewport key to %s', (nodeType) => {
    const missing = VIEWPORT_KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it.each(['SubViewport', 'Window'])('rejects a malformed own_world_3d on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'own_world_3d');
    expect(validator).not.toBeNull();
    expect(validator!('own_world_3d', 'garbage', 1)).not.toBeNull();
    expect(validator!('own_world_3d', 'true', 1)).toBeNull();
  });

  it.each(['SubViewport', 'Window'])('bounds msaa_3d to the four Godot modes on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'msaa_3d')!;
    for (const value of ['0', '1', '2', '3']) expect(validator('msaa_3d', value, 1)).toBeNull();
    expect(validator('msaa_3d', '4', 1)).not.toBeNull();
  });

  it('leaves SubViewport-only members off the shared set', () => {
    // `size`, `size_2d_override*` and `render_target_*` are SubViewport's own
    // (doc/classes/SubViewport.xml); a Window has none of them.
    for (const key of ['size', 'size_2d_override', 'render_target_update_mode']) {
      expect(validatorRegistry.getOwnKeys('Viewport')).not.toContain(key);
    }
  });

  /** Delivery to both node types is pinned above; these check the VALUE checks. */
  function find(key: string) {
    const validator = validatorRegistry.findValidator('SubViewport', key);
    expect(validator, `no validator registered for SubViewport.${key}`).not.toBeNull();
    return validator!;
  }

  describe('plain booleans', () => {
    it.each(BOOLEAN_KEYS)('rejects a malformed %s, accepts true/false', (key) => {
      const validator = find(key);
      expect(validator(key, 'garbage', 1)).not.toBeNull();
      expect(validator(key, 'true', 1)).toBeNull();
      expect(validator(key, 'false', 1)).toBeNull();
    });
  });

  describe('enums with an ERR_FAIL_INDEX guard (error tier)', () => {
    it('accepts msaa_2d 3 (8X), the top of MSAA_MAX; rejects 4, one past it (viewport.cpp:3748)', () => {
      const validator = find('msaa_2d');
      for (const value of ['0', '1', '2', '3']) expect(validator('msaa_2d', value, 1)).toBeNull();
      const rejected = validator('msaa_2d', '4', 1);
      expect(rejected).not.toBeNull();
      expect(rejected!.severity).toBe('error');
    });

    it('accepts canvas_item_default_texture_repeat 2 (MIRROR); rejects 3, past DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_MAX (viewport.cpp:3999)', () => {
      const validator = find('canvas_item_default_texture_repeat');
      for (const value of ['0', '1', '2']) {
        expect(validator('canvas_item_default_texture_repeat', value, 1)).toBeNull();
      }
      const rejected = validator('canvas_item_default_texture_repeat', '3', 1);
      expect(rejected).not.toBeNull();
      expect(rejected!.severity).toBe('error');
    });

    it('accepts screen_space_aa 2 (SMAA); rejects 3, past SCREEN_SPACE_AA_MAX (viewport.cpp:3778)', () => {
      const validator = find('screen_space_aa');
      for (const value of ['0', '1', '2']) expect(validator('screen_space_aa', value, 1)).toBeNull();
      const rejected = validator('screen_space_aa', '3', 1);
      expect(rejected).not.toBeNull();
      expect(rejected!.severity).toBe('error');
    });

    it('accepts sdf_oversize 3 (200%); rejects 4, past SDF_OVERSIZE_MAX (viewport.cpp:4202)', () => {
      const validator = find('sdf_oversize');
      for (const value of ['0', '1', '2', '3']) expect(validator('sdf_oversize', value, 1)).toBeNull();
      const rejected = validator('sdf_oversize', '4', 1);
      expect(rejected).not.toBeNull();
      expect(rejected!.severity).toBe('error');
    });

    it('accepts sdf_scale 2 (25%); rejects 3, past SDF_SCALE_MAX (viewport.cpp:4214)', () => {
      const validator = find('sdf_scale');
      for (const value of ['0', '1', '2']) expect(validator('sdf_scale', value, 1)).toBeNull();
      const rejected = validator('sdf_scale', '3', 1);
      expect(rejected).not.toBeNull();
      expect(rejected!.severity).toBe('error');
    });

    it.each(['positional_shadow_atlas_quad_0', 'positional_shadow_atlas_quad_1', 'positional_shadow_atlas_quad_2', 'positional_shadow_atlas_quad_3'])(
      'accepts %s 6 (1024 Shadows); rejects 7, past SHADOW_ATLAS_QUADRANT_SUBDIV_MAX (viewport.cpp:1413)',
      (key) => {
        const validator = find(key);
        for (const value of ['0', '1', '2', '3', '4', '5', '6']) {
          expect(validator(key, value, 1)).toBeNull();
        }
        const rejected = validator(key, '7', 1);
        expect(rejected).not.toBeNull();
        expect(rejected!.severity).toBe('error');
      }
    );
  });

  describe('enums that bare-assign, no ERR_FAIL_INDEX (warning tier)', () => {
    it('accepts anisotropic_filtering_level 4 (16X); warns at 5, one past the ANISOTROPY_MAX hint (viewport.cpp:5180)', () => {
      const validator = find('anisotropic_filtering_level');
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(validator('anisotropic_filtering_level', value, 1)).toBeNull();
      }
      const warned = validator('anisotropic_filtering_level', '5', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });

    it('accepts debug_draw 26 (Internal Buffer); warns at 27, one past the 27-label hint (viewport.cpp:5172)', () => {
      const validator = find('debug_draw');
      expect(validator('debug_draw', '0', 1)).toBeNull();
      expect(validator('debug_draw', '26', 1)).toBeNull();
      const warned = validator('debug_draw', '27', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });

    it('accepts scaling_3d_mode 4 (MetalFX Temporal); warns at 5, past SCALING_3D_MODE_MAX hint (viewport.cpp:5177)', () => {
      const validator = find('scaling_3d_mode');
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(validator('scaling_3d_mode', value, 1)).toBeNull();
      }
      const warned = validator('scaling_3d_mode', '5', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });

    it('accepts vrs_mode 2 (XR); warns at 3, past VRS_MAX hint (viewport.cpp:5183)', () => {
      const validator = find('vrs_mode');
      for (const value of ['0', '1', '2']) expect(validator('vrs_mode', value, 1)).toBeNull();
      const warned = validator('vrs_mode', '3', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });

    it('accepts vrs_update_mode 2 (Always); warns at 3, past VRS_UPDATE_MAX hint (viewport.cpp:5184)', () => {
      const validator = find('vrs_update_mode');
      for (const value of ['0', '1', '2']) expect(validator('vrs_update_mode', value, 1)).toBeNull();
      const warned = validator('vrs_update_mode', '3', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });
  });

  describe('mesh_lod_threshold: hinted RANGE "0,1024,0.1" (viewport.cpp:5171), both ends warning', () => {
    it('accepts the closed boundaries 0 and 1024', () => {
      const validator = find('mesh_lod_threshold');
      expect(validator('mesh_lod_threshold', '0', 1)).toBeNull();
      expect(validator('mesh_lod_threshold', '1024', 1)).toBeNull();
    });

    it('warns one past each end: -1 and 1025', () => {
      const validator = find('mesh_lod_threshold');
      const low = validator('mesh_lod_threshold', '-1', 1);
      expect(low).not.toBeNull();
      expect(low!.severity).toBe('warning');
      const high = validator('mesh_lod_threshold', '1025', 1);
      expect(high).not.toBeNull();
      expect(high!.severity).toBe('warning');
    });

    it('accepts every legal float literal Godot writes: inf, -inf, inf_neg, nan', () => {
      // set_mesh_lod_threshold (viewport.cpp:3819-3823) never refuses a value:
      // inf/-inf breach the hint and warn, nan compares false against both ends
      // and passes through with no diagnostic at all.
      const validator = find('mesh_lod_threshold');
      expect(validator('mesh_lod_threshold', 'inf', 1)!.severity).toBe('warning');
      expect(validator('mesh_lod_threshold', '-inf', 1)!.severity).toBe('warning');
      expect(validator('mesh_lod_threshold', 'inf_neg', 1)!.severity).toBe('warning');
      expect(validator('mesh_lod_threshold', 'nan', 1)).toBeNull();
    });
  });

  describe('texture_mipmap_bias: hinted RANGE "-2,2,0.001" (viewport.cpp:5179), both ends warning', () => {
    it('accepts the closed boundaries -2 and 2', () => {
      const validator = find('texture_mipmap_bias');
      expect(validator('texture_mipmap_bias', '-2', 1)).toBeNull();
      expect(validator('texture_mipmap_bias', '2', 1)).toBeNull();
    });

    it('warns one past each end: -2.001 and 2.001', () => {
      const validator = find('texture_mipmap_bias');
      const low = validator('texture_mipmap_bias', '-2.001', 1);
      expect(low).not.toBeNull();
      expect(low!.severity).toBe('warning');
      const high = validator('texture_mipmap_bias', '2.001', 1);
      expect(high).not.toBeNull();
      expect(high!.severity).toBe('warning');
    });

    it('accepts nan, since it compares false against both ends of the bare-assign setter', () => {
      expect(find('texture_mipmap_bias')('texture_mipmap_bias', 'nan', 1)).toBeNull();
    });
  });

  describe('oversampling_override: hinted RANGE "0,16,0.0001,or_greater" (viewport.cpp:5221), floor only', () => {
    it('accepts 0, the closed floor', () => {
      expect(find('oversampling_override')('oversampling_override', '0', 1)).toBeNull();
    });

    it('warns just under the floor: -0.0001', () => {
      const warned = find('oversampling_override')('oversampling_override', '-0.0001', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });

    it('accepts inf: `or_greater` opens the ceiling, so nothing bounds the top', () => {
      expect(find('oversampling_override')('oversampling_override', 'inf', 1)).toBeNull();
    });
  });

  describe('fsr_sharpness: enforced floor + hinted ceiling (viewport.cpp:4885-4897, 5181)', () => {
    it('accepts the floor 0 and the hinted ceiling 2', () => {
      const validator = find('fsr_sharpness');
      expect(validator('fsr_sharpness', '0', 1)).toBeNull();
      expect(validator('fsr_sharpness', '2', 1)).toBeNull();
    });

    it('errors just under the floor: -0.001 (set_fsr_sharpness clamps it to 0)', () => {
      const rejected = find('fsr_sharpness')('fsr_sharpness', '-0.001', 1);
      expect(rejected).not.toBeNull();
      expect(rejected!.severity).toBe('error');
    });

    it('warns just past the ceiling: 2.001 (the setter never checks it, only the hint does)', () => {
      const warned = find('fsr_sharpness')('fsr_sharpness', '2.001', 1);
      expect(warned).not.toBeNull();
      expect(warned!.severity).toBe('warning');
    });

    it('errors on -inf (below the enforced floor) and warns on inf (above the hinted ceiling only)', () => {
      const validator = find('fsr_sharpness');
      expect(validator('fsr_sharpness', '-inf', 1)!.severity).toBe('error');
      expect(validator('fsr_sharpness', 'inf', 1)!.severity).toBe('warning');
    });
  });

  describe('scaling_3d_scale: CLAMP(0.1, 2.0) at viewport.cpp:4875, error tier', () => {
    it('accepts the clamp boundaries 0.1 and 2.0 (not the stale 0.25 hint at viewport.cpp:5178)', () => {
      const validator = find('scaling_3d_scale');
      expect(validator('scaling_3d_scale', '0.1', 1)).toBeNull();
      expect(validator('scaling_3d_scale', '2.0', 1)).toBeNull();
      // 0.2 sits inside the CLAMP but below the hint's stale 0.25 floor: the
      // hint is not what runs, so this must stay clean.
      expect(validator('scaling_3d_scale', '0.2', 1)).toBeNull();
    });

    it('errors just outside the clamp: 0.099 and 2.001', () => {
      const validator = find('scaling_3d_scale');
      const low = validator('scaling_3d_scale', '0.099', 1);
      expect(low).not.toBeNull();
      expect(low!.severity).toBe('error');
      const high = validator('scaling_3d_scale', '2.001', 1);
      expect(high).not.toBeNull();
      expect(high!.severity).toBe('error');
    });

    it('errors on inf and -inf, which CLAMP pulls in just like any other out-of-range value', () => {
      const validator = find('scaling_3d_scale');
      expect(validator('scaling_3d_scale', 'inf', 1)!.severity).toBe('error');
      expect(validator('scaling_3d_scale', '-inf', 1)!.severity).toBe('error');
    });

    it('accepts nan: CLAMP\'s own comparisons are false against nan, so Godot stores it unaltered too', () => {
      expect(find('scaling_3d_scale')('scaling_3d_scale', 'nan', 1)).toBeNull();
    });
  });

  describe('canvas_cull_mask: PROPERTY_HINT_LAYERS_2D_RENDER (viewport.cpp:5218), warning tier', () => {
    it('accepts 0 and the 32-bit ceiling 4294967295', () => {
      const validator = find('canvas_cull_mask');
      expect(validator('canvas_cull_mask', '0', 1)).toBeNull();
      expect(validator('canvas_cull_mask', '4294967295', 1)).toBeNull();
    });

    it('warns on -1 and one past the ceiling, 4294967296', () => {
      const validator = find('canvas_cull_mask');
      const low = validator('canvas_cull_mask', '-1', 1);
      expect(low).not.toBeNull();
      expect(low!.severity).toBe('warning');
      const high = validator('canvas_cull_mask', '4294967296', 1);
      expect(high).not.toBeNull();
      expect(high!.severity).toBe('warning');
    });
  });

  describe('unbounded ints: no PROPERTY_HINT_RANGE, bare-assign setters', () => {
    it.each(['gui_drag_threshold', 'positional_shadow_atlas_size'])(
      'accepts any integer, negative or large, for %s',
      (key) => {
        const validator = find(key);
        expect(validator(key, '-1000000', 1)).toBeNull();
        expect(validator(key, '999999999', 1)).toBeNull();
      }
    );

    it.each(['gui_drag_threshold', 'positional_shadow_atlas_size'])(
      'rejects a non-numeric %s',
      (key) => {
        const validator = find(key);
        expect(validator(key, 'garbage', 1)).not.toBeNull();
      }
    );
  });

  describe('Resource references (format-only): vrs_texture, world_3d', () => {
    it.each(['vrs_texture', 'world_3d'])('accepts SubResource/ExtResource for %s', (key) => {
      const validator = find(key);
      expect(validator(key, 'SubResource("1")', 1)).toBeNull();
      expect(validator(key, 'ExtResource("2")', 1)).toBeNull();
    });

    it.each(['vrs_texture', 'world_3d'])(
      'rejects the bare literal null for %s: Godot omits the key instead of writing it',
      (key) => {
        const validator = find(key);
        expect(validator(key, 'null', 1)).not.toBeNull();
      }
    );
  });
});
