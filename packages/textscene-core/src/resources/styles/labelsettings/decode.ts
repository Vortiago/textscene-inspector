/**
 * Decode a LabelSettings resource body, whichever serialisation it arrived
 * in — inline `[sub_resource type="LabelSettings"]`, or the `[resource]`
 * body of a standalone `.tres` `ExtResource` names.
 *
 * Pure `.ts`, no THREE.
 */
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { colorOr, type Color } from '../../../utils/colorParser';
import { floatOr, intOr } from '../../../parser/valueParsers';
import type { LabelSettingsResource } from './types';

/** `label_settings.h:59,62` — both colour fields' shared default. */
const DEFAULT_WHITE: Color = { r: 1, g: 1, b: 1, a: 1 };
/** `Font::DEFAULT_FONT_SIZE` (`core/io/resource.h`'s font default, mirrored at `label_settings.h:58`). */
const DEFAULT_FONT_SIZE = 16;
const CONTEXT = 'LabelSettings';

/** Decode a LabelSettings resource body — an absent/malformed field falls back to the class's own default rather than warning the whole resource away. */
export function decodeLabelSettings(data: Record<string, string>): LabelSettingsResource {
  return {
    lineSpacing: floatOr(data.line_spacing, 3, CONTEXT),
    font: data.font,
    fontSize: intOr(data.font_size, DEFAULT_FONT_SIZE, CONTEXT),
    fontColor: colorOr(data.font_color, DEFAULT_WHITE),
    outlineSize: intOr(data.outline_size, 0, CONTEXT),
    outlineColor: colorOr(data.outline_color, DEFAULT_WHITE),
  };
}

/** The `LabelSettings` a `SubResource("id")` property names, or null when the reference is absent, not a SubResource, or names something else. */
export function resolveLabelSettings(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): LabelSettingsResource | null {
  const resource = resolveSubResourceRef(ref, internalResources);
  if (resource?.type !== 'LabelSettings') return null;
  return decodeLabelSettings(resource.data as Record<string, string>);
}

/** The `LabelSettings` a standalone resource file carries, or null when the file is some other resource type. */
export function labelSettingsFromResource(parsed: ParsedResource): LabelSettingsResource | null {
  if (parsed.resourceType !== 'LabelSettings') return null;
  return decodeLabelSettings(parsed.properties);
}
