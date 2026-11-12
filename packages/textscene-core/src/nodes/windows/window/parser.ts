/**
 * The lenient parse of a Window, a Popup or a PopupPanel. Each class sets its own constructor
 * defaults (`windowClassDefaults`), and the scene lines override them.
 */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { unquoteString } from '../../../parser/utils';
import type { Vector2 } from '../../../godot/math/vector';
import { boolOr, floatOr, intOr, parseOptionalVector2i, vec2iOr } from '../../../parser/valueParsers';
import {
  clampLimitSize,
  InitialPosition,
  constructedForceNativeState,
  replayForceNative,
  isWindowSizeKey,
  replayWindowSize,
  windowClassDefaults,
  type WindowSizeWrite,
} from '../../../godot/scene/window';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { parseViewport, viewportParseContext } from '../../viewport/shared/parser';
import { parseThemeOwnerFields } from '../../2d/ui/control/themeOwnerParser';
import { DEFAULT_CONTENT_SCALE, type ContentScale } from './contentScale';
import type { WindowProperties } from './types';

/** Frozen: every parsed window shares it as a default, so no reader may write through it. */
const ORIGIN = Object.freeze({ x: 0, y: 0 });

/** The size lines of `lines` in file order, a malformed one skipped as the lenient parse skips any bad value. */
function sizeLineWrites(lines: Record<string, string>): WindowSizeWrite[] {
  const writes: WindowSizeWrite[] = [];
  for (const [key, raw] of Object.entries(lines)) {
    if (!isWindowSizeKey(key)) continue;
    const value = parseOptionalVector2i(raw);
    if (value) writes.push({ key, value });
  }
  return writes;
}

/**
 * The size after the scene lines run: an override's lines over the size and limits the base left, or
 * one file's lines over what the constructor left. A class that floors its size in its constructor
 * writes `min_size` first.
 */
function parseSize(
  properties: Record<string, string>,
  defaults: ReturnType<typeof windowClassDefaults>,
  override: OverrideLayer<WindowProperties> | undefined
): Vector2 {
  const start: WindowSizeWrite[] = override
    ? [
        { key: 'min_size', value: override.held.min_size },
        { key: 'max_size', value: override.held.max_size },
        { key: 'size', value: override.held.size },
      ]
    : [
        { key: 'min_size', value: defaults.minSize },
        ...(defaults.size ? [{ key: 'size' as const, value: defaults.size }] : []),
      ];
  return replayWindowSize([...start, ...sizeLineWrites(override ? override.written : properties)]);
}

/** The `content_scale_*` keys. A setter refuses a negative size or a factor at or below 0 (`window.cpp:1716,1774`). */
function parseContentScale(properties: Record<string, string>, context: string): ContentScale {
  const unset = DEFAULT_CONTENT_SCALE;
  const size = vec2iOr(properties.content_scale_size, unset.size, `${context}.content_scale_size`);
  const factor = floatOr(properties.content_scale_factor, unset.factor, `${context}.content_scale_factor`);
  return {
    mode: intOr(properties.content_scale_mode, unset.mode, `${context}.content_scale_mode`),
    aspect: intOr(properties.content_scale_aspect, unset.aspect, `${context}.content_scale_aspect`),
    stretch: intOr(properties.content_scale_stretch, unset.stretch, `${context}.content_scale_stretch`),
    size: size.x < 0 || size.y < 0 ? unset.size : size,
    factor: factor > 0 ? factor : unset.factor,
  };
}

/**
 * `transparent_bg` and the `transparent` flag both set the background (`window.cpp:548-549`), so the
 * line written last wins. Without either, `held` stands: the constructor's flag, or what an
 * instanced base left under an override's lines.
 */
function replayTransparentBackground(lines: Record<string, string>, held: boolean, context: string): boolean {
  const flag = boolOr(lines.transparent, held, context);
  if (lines.transparent_bg === undefined) return flag;
  const keys = Object.keys(lines);
  const isFlagLast = keys.indexOf('transparent') > keys.indexOf('transparent_bg');
  return isFlagLast ? flag : boolOr(lines.transparent_bg, held, context);
}

/**
 * `force_native` after the scene lines run: an override's lines over what the base left, or one
 * file's lines over what the constructor left.
 */
function parseForceNative(
  type: string,
  properties: Record<string, string>,
  override: OverrideLayer<WindowProperties> | undefined
): boolean {
  if (properties.force_native === undefined) return false;
  return override
    ? replayForceNative(override.held, override.written)
    : replayForceNative(constructedForceNativeState(type), properties);
}

export function parseWindow(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<WindowProperties>
): WindowProperties {
  const viewport = parseViewport(heading, properties);
  const type = heading.attributes.type ?? 'Window';
  const defaults = windowClassDefaults(type);
  const context = viewportParseContext(heading, viewport.name);
  const visible = boolOr(properties.visible, defaults.visible, context);

  return {
    ...viewport,
    ...parseThemeOwnerFields(properties),
    transparent_bg: override
      ? replayTransparentBackground(override.written, override.held.transparent_bg, context)
      : replayTransparentBackground(properties, defaults.transparent, context),
    size: parseSize(properties, defaults, override),
    size_2d_override: ORIGIN,
    size_2d_override_stretch: false,
    // `Window()` disables the update (`window.cpp:3578`), and the embedder sets
    // WHEN_PARENT_VISIBLE on a visible window it registers (`window.cpp:1562`).
    render_target_update_mode: visible
      ? SubViewportUpdateMode.WHEN_PARENT_VISIBLE
      : SubViewportUpdateMode.DISABLED,
    render_target_clear_mode: SubViewportClearMode.ALWAYS,
    title: properties.title === undefined ? defaults.title : unquoteString(properties.title),
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
    exclusive: boolOr(properties.exclusive, defaults.exclusive, context),
    wrap_controls: boolOr(properties.wrap_controls, defaults.wrapControls, context),
    force_native: parseForceNative(type, properties, override),
    min_size: clampLimitSize(vec2iOr(properties.min_size, defaults.minSize, context)),
    max_size: clampLimitSize(vec2iOr(properties.max_size, ORIGIN, context)),
    content_scale: parseContentScale(properties, context),
  };
}
