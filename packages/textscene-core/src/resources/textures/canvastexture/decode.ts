/**
 * CanvasTexture decode: the specular shading and the sampler override.
 * Every default is Godot's member initialiser (`scene/main/canvas_item.h:433-442`). No THREE.
 */

import { enumOr, floatOr } from '../../../parser/valueParsers.js';
import { colorOr } from '../../../utils/colorParser.js';
import { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../godot/scene/canvasItem.js';
import type { Rgba } from '../../../godot/math/math.js';
import { unitByte } from '../../../godot/rendering/unitByte.js';
import type { CanvasTextureData } from './types.js';

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
const TEXTURE_FILTERS = Object.values(CanvasItemTextureFilter);
const TEXTURE_REPEATS = Object.values(CanvasItemTextureRepeat);

/**
 * The shininess at and above which the renderer leaves specular off
 * (`renderer_canvas_render_rd.cpp:3337`).
 */
const SPECULAR_OFF_SHININESS = 0.999;

export function decodeCanvasTexture(properties: Readonly<Record<string, string>>): CanvasTextureData {
  return {
    specularColor: colorOr(properties.specular_color, WHITE),
    specularShininess: floatOr(properties.specular_shininess, 1, 'CanvasTexture specular_shininess'),
    textureFilter: enumOr(
      properties.texture_filter,
      CanvasItemTextureFilter.PARENT_NODE,
      TEXTURE_FILTERS,
      'CanvasTexture texture_filter'
    ),
    textureRepeat: enumOr(
      properties.texture_repeat,
      CanvasItemTextureRepeat.PARENT_NODE,
      TEXTURE_REPEATS,
      'CanvasTexture texture_repeat'
    ),
  };
}

/**
 * `Color(specular_color.rgb, specular_shininess)` as the shader reads it, packed to unorm8
 * (`renderer_canvas_render_rd.cpp:3337-3346`), or null while the shininess leaves specular off.
 * Specular applies only with a normal map, which the caller checks.
 */
export function canvasTextureSpecular(texture: CanvasTextureData): Rgba | null {
  const { specularColor: color, specularShininess: shininess } = texture;
  if (shininess >= SPECULAR_OFF_SHININESS) return null;
  return { r: unitByte(color.r), g: unitByte(color.g), b: unitByte(color.b), a: unitByte(shininess) };
}
