/**
 * SubViewport parser: the Viewport keys plus SubViewport's own. Every default is Godot's, from
 * `doc/classes/SubViewport.xml`, since a wrong default is a rendering bug no fixture reveals.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, enumOr, vec2iOr } from '../../../parser/valueParsers';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { parseViewport, viewportParseContext } from '../shared/parser';
import type { SubViewportProperties } from './types';

const UPDATE_MODES = Object.values(SubViewportUpdateMode);
const CLEAR_MODES = Object.values(SubViewportClearMode);

export function parseSubViewport(
  heading: ParsedHeading,
  properties: Record<string, string>
): SubViewportProperties {
  const viewport = parseViewport(heading, properties);
  const context = viewportParseContext(heading, viewport.name);

  return {
    ...viewport,
    size: vec2iOr(properties.size, { x: 512, y: 512 }, context),
    size_2d_override: vec2iOr(properties.size_2d_override, { x: 0, y: 0 }, context),
    size_2d_override_stretch: boolOr(properties.size_2d_override_stretch, false, context),
    render_target_update_mode: enumOr(
      properties.render_target_update_mode,
      SubViewportUpdateMode.WHEN_VISIBLE,
      UPDATE_MODES,
      context
    ),
    render_target_clear_mode: enumOr(
      properties.render_target_clear_mode,
      SubViewportClearMode.ALWAYS,
      CLEAR_MODES,
      context
    ),
  };
}
