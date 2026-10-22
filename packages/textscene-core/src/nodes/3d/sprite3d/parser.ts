/**
 * Sprite3D parser: Sprite3D TSCN properties into a typed shape, with Godot's defaults: billboard 0
 * (DISABLED, as for Label3D, see label3d/types.ts), hframes and vframes 1, frame 0, pixel_size
 * 0.01, and an opaque white modulate.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';
import { parseColor } from '../../../utils/colorParser';
import { parseMaterialFor2dFields } from '../../../parser/materialFor2dParser';
import { boolOr, intOr, parseOptionalRect2 } from '../../../parser/valueParsers';
import { type Sprite3DProperties } from './types';
import { holdsResource } from '../../../godot/scene/resourceLiteral.js';
import { frameCoords, replaySpriteFrames } from '../../../godot/scene/spriteFrames.js';
import { parseSpriteQuad } from './quadParser';

export function parseSprite3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Sprite3DProperties {
  const frames = replaySpriteFrames(properties);
  const baseProps = parseGeometryInstance3D(heading, properties);

  const result: Sprite3DProperties = {
    ...baseProps,
    ...parseSpriteQuad(properties, 'Sprite3D'),
    // The grid and frame Godot holds after replaying the body in file order:
    // a count below 1 is refused, a refused `frame` stays 0, a later `hframes`
    // re-maps one that landed (godot/scene/spriteFrames.ts).
    hframes: frames.hframes,
    vframes: frames.vframes,
    frame: frames.frame,
    flip_h: boolOr(properties.flip_h, false),
    flip_v: boolOr(properties.flip_v, false),
    transparent: boolOr(properties.transparent, true),
    region_enabled: boolOr(properties.region_enabled, false),
    modulate: properties.modulate ? parseColor(properties.modulate) : { r: 1, g: 1, b: 1, a: 1 },
    // The `SpriteBase3D()` flag loop leaves every flag but TRANSPARENT and
    // DOUBLE_SIDED false (`sprite_3d.cpp:712-714`).
    shaded: boolOr(properties.shaded, false, 'Sprite3D shaded'),
    ...parseMaterialFor2dFields(properties, 'Sprite3D'),
    render_priority: intOr(properties.render_priority, 0),
  };

  if (holdsResource(properties.texture)) {
    result.texture = properties.texture;
  }

  // The stored frame's own coordinates: the renderer prefers this field, and
  // the authored pair may have been refused or re-mapped.
  if (frames.writes.some((w) => w.key === 'frame_coords')) result.frame_coords = frameCoords(frames);

  if (properties.region_rect) {
    const rect = parseOptionalRect2(properties.region_rect, 'Sprite3D region_rect');
    if (rect) result.region_rect = rect;
  }

  return result;
}
