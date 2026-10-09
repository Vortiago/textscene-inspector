/** A parsed Label3D at Godot's defaults, with the text `Hi`, for a glyph test. */

import { GEOMETRY_INSTANCE_DEFAULTS } from '../../geometryinstance3d/types';
import {
  AlphaCutMode,
  BillboardMode,
  HorizontalAlignment,
  TextureFilter,
  type Label3DProperties,
} from '../types';

export function labelProperties(overrides: Partial<Label3DProperties> = {}): Label3DProperties {
  return {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'L',
    text: 'Hi',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_DISABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    double_sided: true,
    font_size: 32,
    line_spacing: 0,
    horizontal_alignment: HorizontalAlignment.CENTER,
    no_depth_test: false,
    render_priority: 0,
    outline_render_priority: -1,
    alpha_cut: AlphaCutMode.DISABLED,
    alpha_scissor_threshold: 0.5,
    alpha_hash_scale: 1,
    fixed_size: false,
    texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
    ...overrides,
  };
}
