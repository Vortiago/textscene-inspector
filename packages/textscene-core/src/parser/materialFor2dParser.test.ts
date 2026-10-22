/** The `get_material_for_2d` fields Label3D and Sprite3D both store, parsed once for both. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../logger';
import { parseMaterialFor2dFields } from './materialFor2dParser';
import { AlphaCutMode } from '../godot/rendering/materials/alphaCut';
import { TextureFilter } from '../godot/rendering/materials/textureFilter';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('parseMaterialFor2dFields', () => {
  it('holds the defaults the Label3D and SpriteBase3D constructors share when nothing is set', () => {
    expect(parseMaterialFor2dFields({}, 'Label3D')).toEqual({
      alpha_cut: AlphaCutMode.DISABLED,
      alpha_scissor_threshold: 0.5,
      alpha_hash_scale: 1,
      alpha_antialiasing_mode: 0,
      alpha_antialiasing_edge: 0,
      texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
      no_depth_test: false,
      double_sided: true,
      fixed_size: false,
    });
  });

  it('reads every field as set', () => {
    const fields = parseMaterialFor2dFields(
      {
        alpha_cut: '3',
        alpha_scissor_threshold: '0.25',
        alpha_hash_scale: '1.5',
        alpha_antialiasing_mode: '2',
        alpha_antialiasing_edge: '0.4',
        texture_filter: '0',
        no_depth_test: 'true',
        double_sided: 'false',
        fixed_size: 'true',
      },
      'Sprite3D'
    );
    expect(fields).toEqual({
      alpha_cut: AlphaCutMode.HASH,
      alpha_scissor_threshold: 0.25,
      alpha_hash_scale: 1.5,
      alpha_antialiasing_mode: 2,
      alpha_antialiasing_edge: 0.4,
      texture_filter: TextureFilter.NEAREST,
      no_depth_test: true,
      double_sided: false,
      fixed_size: true,
    });
  });

  it('keeps DISABLED for an alpha_cut the setter refuses, and names the node in the warning', () => {
    // `ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX)` at `label_3d.cpp:1013`.
    expect(parseMaterialFor2dFields({ alpha_cut: '4' }, 'Label3D').alpha_cut).toBe(AlphaCutMode.DISABLED);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Label3D alpha_cut'));
  });
});
