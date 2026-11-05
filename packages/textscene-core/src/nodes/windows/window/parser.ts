/**
 * The lenient parse of a Window, a Popup or a PopupPanel. Each class sets its own constructor
 * defaults (`windowClassDefaults`), and the scene lines override them.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { unquoteString } from '../../../parser/utils';
import { boolOr, intOr, parseOptionalVector2i, vec2iOr } from '../../../parser/valueParsers';
import {
  clampLimitSize,
  InitialPosition,
  replayWindowSize,
  windowClassDefaults,
  type WindowSizeWrite,
} from '../../../godot/scene/window';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { parseViewport } from '../../viewport/shared/parser';
import { parseThemeOwnerFields } from '../../2d/ui/control/parser';
import type { WindowProperties } from './types';

const ORIGIN = { x: 0, y: 0 };
const SIZE_KEYS: ReadonlySet<string> = new Set(['size', 'min_size', 'max_size']);

/** The size lines in file order, a malformed one skipped as the lenient parse skips any bad value. */
function sizeWrites(properties: Record<string, string>): WindowSizeWrite[] {
  const writes: WindowSizeWrite[] = [];
  for (const [key, raw] of Object.entries(properties)) {
    if (!SIZE_KEYS.has(key)) continue;
    const value = parseOptionalVector2i(raw);
    if (value) writes.push({ key: key as WindowSizeWrite['key'], value });
  }
  return writes;
}

export function parseWindow(heading: ParsedHeading, properties: Record<string, string>): WindowProperties {
  const viewport = parseViewport(heading, properties);
  const defaults = windowClassDefaults(heading.attributes.type ?? 'Window');
  const context = `${heading.attributes.type ?? 'Window'} ${viewport.name || '(unnamed)'}`;
  const visible = boolOr(properties.visible, defaults.visible, context);
  // `set_flag(FLAG_TRANSPARENT)` sets the transparent background (`window.cpp:548-549`).
  const transparent = boolOr(properties.transparent, defaults.transparent, context);

  return {
    ...viewport,
    ...parseThemeOwnerFields(properties),
    transparent_bg: viewport.transparent_bg || transparent,
    size: replayWindowSize(sizeWrites(properties)),
    size_2d_override: ORIGIN,
    size_2d_override_stretch: false,
    // `Window()` disables the update (`window.cpp:3578`), and the embedder sets
    // WHEN_PARENT_VISIBLE on a visible window it registers (`window.cpp:1562`).
    render_target_update_mode: visible
      ? SubViewportUpdateMode.WHEN_PARENT_VISIBLE
      : SubViewportUpdateMode.DISABLED,
    render_target_clear_mode: SubViewportClearMode.ALWAYS,
    title: properties.title === undefined ? '' : unquoteString(properties.title),
    position: vec2iOr(properties.position, ORIGIN, context),
    initial_position: intOr(
      properties.initial_position,
      InitialPosition.ABSOLUTE,
      `${context}.initial_position`
    ),
    visible,
    borderless: boolOr(properties.borderless, defaults.borderless, context),
    unfocusable: boolOr(properties.unfocusable, false, context),
    always_on_top: boolOr(properties.always_on_top, false, context),
    wrap_controls: boolOr(properties.wrap_controls, defaults.wrapControls, context),
    force_native: boolOr(properties.force_native, false, context),
    min_size: clampLimitSize(vec2iOr(properties.min_size, ORIGIN, context)),
    max_size: clampLimitSize(vec2iOr(properties.max_size, ORIGIN, context)),
  };
}
