/**
 * The lenient parse of a Window, a Popup or a PopupPanel. Each class sets its own constructor
 * defaults (`windowClassDefaults`), and the scene lines override them.
 */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { unquoteString } from '../../../parser/utils';
import type { Vector2 } from '../../../godot/math/vector';
import { boolSlotValue } from '../../../godot/variant/variantBool';
import { boolOr, floatOr, intOr, parseOptionalVector2i, vec2iOr } from '../../../parser/valueParsers';
import {
  clampLimitSize,
  InitialPosition,
  constructedForceNativeState,
  constructorWritesSize,
  replayForceNative,
  isWindowSizeKey,
  replayWindowSize,
  windowClassDefaults,
  type ForceNativeState,
  type WindowSizeWrite,
} from '../../../godot/scene/window';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { parseViewport, viewportParseContext } from '../../viewport/shared/parser';
import { parseThemeOwnerFields } from '../../2d/ui/control/themeOwnerParser';
import { DEFAULT_CONTENT_SCALE, type ContentScale } from './contentScale';
import { BEFORE_THE_LINES, type WindowProperties } from './types';

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
 * The lines a parse replays in file order, and the state they run over: an override's lines over
 * what the instanced base left, or one file's lines over what the constructor left.
 */
interface WindowReplay {
  /** Named `properties`: the grammar parity scan reads the keys a parser names on that bag. */
  properties: Record<string, string>;
  /** The background before the lines run, which either background key replaces. */
  transparentBackground: boolean;
  /** The size writes before the lines run. A class that floors its size in its constructor writes `min_size` first. */
  size: WindowSizeWrite[];
  forceNative: ForceNativeState;
  /** `wrap_controls` before the lines run. */
  wrapsControls: boolean;
  /** Whether a size write before the lines clamped the window to its contents minimum. */
  clampsBeforeTheLines: boolean;
}

function windowReplay(
  type: string,
  properties: Record<string, string>,
  override: OverrideLayer<WindowProperties> | undefined
): WindowReplay {
  if (override) {
    const { held } = override;
    return {
      properties: override.written,
      transparentBackground: held.transparent_bg,
      size: [
        { key: 'min_size', value: held.min_size },
        { key: 'max_size', value: held.max_size },
        { key: 'size', value: held.size },
      ],
      forceNative: held,
      wrapsControls: held.wrap_controls,
      clampsBeforeTheLines: held.keeps_load_clamp,
    };
  }
  const defaults = windowClassDefaults(type);
  return {
    properties,
    transparentBackground: defaults.transparent,
    size: [
      { key: 'min_size', value: defaults.minSize },
      ...(defaults.size ? [{ key: 'size' as const, value: defaults.size }] : []),
    ],
    forceNative: constructedForceNativeState(type),
    wrapsControls: defaults.wrapControls,
    clampsBeforeTheLines: defaults.wrapControls && constructorWritesSize(type),
  };
}

/** Where the lines clamp the window to its contents minimum before it enters the tree. */
interface LoadClamp {
  firstLine: number | null;
  isKept: boolean;
}

/**
 * {@link WindowProperties.load_clamp_line} and {@link WindowProperties.keeps_load_clamp}. Each size
 * write asks for the contents minimum while `wrap_controls` is on, but a `min_size` or `max_size`
 * write that leaves its limit unchanged asks for nothing (`window.cpp:486-488,509-511`).
 */
function replayLoadClamp(replay: WindowReplay): LoadClamp {
  const clamp: LoadClamp = replay.clampsBeforeTheLines
    ? { firstLine: BEFORE_THE_LINES, isKept: true }
    : { firstLine: null, isKept: false };
  let { wrapsControls } = replay;
  const limits: Record<'min_size' | 'max_size', Vector2> = { min_size: ORIGIN, max_size: ORIGIN };
  for (const write of replay.size) if (write.key !== 'size') limits[write.key] = clampLimitSize(write.value);
  for (const [line, [key, raw]] of Object.entries(replay.properties).entries()) {
    if (key === 'wrap_controls') wrapsControls = boolSlotValue(raw) ?? wrapsControls;
    if (!isWindowSizeKey(key)) continue;
    const value = parseOptionalVector2i(raw);
    if (!value) continue;
    const asks = key === 'size' || writeLimit(limits, key, clampLimitSize(value));
    if (asks && wrapsControls) {
      clamp.firstLine ??= line;
      clamp.isKept = true;
    } else if (key === 'size') clamp.isKept = false;
  }
  return clamp;
}

/** Writes `value` to the limit `key`, and returns whether that changed the limit. */
function writeLimit(
  limits: Record<'min_size' | 'max_size', Vector2>,
  key: 'min_size' | 'max_size',
  value: Vector2
): boolean {
  const held = limits[key];
  limits[key] = value;
  return held.x !== value.x || held.y !== value.y;
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
function replayTransparentBackground(
  { properties, transparentBackground: held }: WindowReplay,
  context: string
): boolean {
  const flag = boolOr(properties.transparent, held, context);
  if (properties.transparent_bg === undefined) return flag;
  const keys = Object.keys(properties);
  const isFlagLast = keys.indexOf('transparent') > keys.indexOf('transparent_bg');
  return isFlagLast ? flag : boolOr(properties.transparent_bg, held, context);
}

function loadClampProperties({ firstLine, isKept }: LoadClamp) {
  return { load_clamp_line: firstLine, keeps_load_clamp: isKept };
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
  const replay = windowReplay(type, properties, override);
  const visible = boolOr(properties.visible, defaults.visible, context);

  return {
    ...viewport,
    ...parseThemeOwnerFields(properties),
    transparent_bg: replayTransparentBackground(replay, context),
    size: replayWindowSize([...replay.size, ...sizeLineWrites(replay.properties)]),
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
    ...loadClampProperties(replayLoadClamp(replay)),
    force_native:
      properties.force_native !== undefined && replayForceNative(replay.forceNative, replay.properties),
    min_size: clampLimitSize(vec2iOr(properties.min_size, defaults.minSize, context)),
    max_size: clampLimitSize(vec2iOr(properties.max_size, ORIGIN, context)),
    content_scale: parseContentScale(properties, context),
  };
}
