/**
 * Decodes a LabelSettings resource body, from an inline
 * `[sub_resource type="LabelSettings"]` or the `[resource]` body of a `.tres`.
 * No THREE.
 */
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { colorOr } from '../../../utils/colorParser';
import { floatOr, intOr, vec2Or, vec2iOr } from '../../../parser/valueParsers';
import type { LabelSettingsResource, StackedOutline, StackedShadow } from './types';
import type { Rgba } from '../../../godot/math/math';

/** `label_settings.h:59,62`: both colour fields' default. */
const DEFAULT_WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
/** `label_settings.h:65`: transparent, so a Label draws no shadow until this is set. */
const DEFAULT_TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };
/** `Font::DEFAULT_FONT_SIZE` (`core/io/resource.h`'s font default, mirrored at `label_settings.h:58`). */
const DEFAULT_FONT_SIZE = 16;
/** `core/math/color.h:251`: `Color()` is opaque black, the default colour of a stacked element. */
const DEFAULT_BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
/** `label_settings.h:66` and `:48`: the shadow and each stacked shadow default to `(1, 1)`. */
const DEFAULT_SHADOW_OFFSET = { x: 1, y: 1 };
const CONTEXT = 'LabelSettings';

/**
 * The elements `0..count-1` of the array `prefix` names. A count of 0 or less holds none, and an
 * element property at or past the count is never read (`label_settings.cpp:255-262,290-296`).
 */
function decodeStacked<T>(
  data: Record<string, string>,
  prefix: string,
  readElement: (property: (name: string) => string | undefined) => T
): T[] {
  const count = intOr(data[`${prefix}_count`], 0, CONTEXT);
  return Array.from({ length: Math.max(count, 0) }, (_, index) =>
    readElement((name) => data[`${prefix}_${index}/${name}`])
  );
}

function decodeStackedOutline(property: (name: string) => string | undefined): StackedOutline {
  return { size: intOr(property('size'), 0, CONTEXT), color: colorOr(property('color'), DEFAULT_BLACK) };
}

/** The offset is a `Vector2i`: the setter truncates each component toward zero (`label_settings.cpp:359-365`). */
function decodeStackedShadow(property: (name: string) => string | undefined): StackedShadow {
  const offset = vec2iOr(property('offset'), DEFAULT_SHADOW_OFFSET, CONTEXT);
  return {
    offset,
    color: colorOr(property('color'), DEFAULT_BLACK),
    outlineSize: intOr(property('outline_size'), 0, CONTEXT),
  };
}

/** An absent or malformed field falls back to the class default, not a warning for the whole resource. */
function decodeLabelSettings(data: Record<string, string>): LabelSettingsResource {
  return {
    lineSpacing: floatOr(data.line_spacing, 3, CONTEXT),
    paragraphSpacing: floatOr(data.paragraph_spacing, 0, CONTEXT),
    font: data.font,
    fontSize: intOr(data.font_size, DEFAULT_FONT_SIZE, CONTEXT),
    fontColor: colorOr(data.font_color, DEFAULT_WHITE),
    outlineSize: intOr(data.outline_size, 0, CONTEXT),
    outlineColor: colorOr(data.outline_color, DEFAULT_WHITE),
    shadowSize: intOr(data.shadow_size, 1, CONTEXT),
    shadowColor: colorOr(data.shadow_color, DEFAULT_TRANSPARENT),
    shadowOffset: vec2Or(data.shadow_offset, DEFAULT_SHADOW_OFFSET, CONTEXT),
    stackedOutlines: decodeStacked(data, 'stacked_outline', decodeStackedOutline),
    stackedShadows: decodeStacked(data, 'stacked_shadow', decodeStackedShadow),
  };
}

/** The `LabelSettings` a `SubResource("id")` property names, or null when the reference is absent, not a SubResource, or names something else. */
export function resolveLabelSettings(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): LabelSettingsResource | null {
  const resource = resolveSubResourceRef(ref, internalResources);
  if (resource?.type !== 'LabelSettings') return null;
  return decodeLabelSettings(resource.data);
}

/** The `LabelSettings` a standalone resource file carries, or null when the file is some other resource type. */
export function labelSettingsFromResource(parsed: ParsedResource): LabelSettingsResource | null {
  if (parsed.resourceType !== 'LabelSettings') return null;
  return decodeLabelSettings(parsed.properties);
}
