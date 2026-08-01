/**
 * Resolve a Control's StyleBox theme override (e.g. `theme_override_styles/panel
 * = SubResource("StyleBoxFlat_x")`) to CSS, through the stylebox resource slice.
 * Used by the StyleBox-bearing Controls (Panel, PanelContainer, Button, LineEdit).
 *
 * `resolveStyleBox` answers the question a consumer actually has — did a box
 * resolve? `null` means none did (no ref, an unresolvable one, or a box type
 * with no decode, e.g. StyleBoxTexture), and the Control keeps its own default
 * chrome. Anything else is a box that resolved, whose CSS replaces that chrome
 * outright even when the box paints nothing. Reading that distinction off an
 * empty CSS object cannot tell the two apart.
 */

import type { CSSProperties } from 'react';
import type { TscnInternalResource } from '../../parser/types';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { buildStyleBoxCss } from '../../resources/styles/stylebox/build';
import { decodeStyleBox } from '../../resources/styles/stylebox/decode';
import { findSubResource } from '../SceneResourcesContext';

export function resolveStyleBox(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): CSSProperties | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource) return null;
  const decoded = decodeStyleBox(resource.type, resource.data as Record<string, string>);
  return decoded ? buildStyleBoxCss(decoded) : null;
}

/** {@link resolveStyleBox} with every miss collapsed to `{}`. */
export function resolveStyleBoxCss(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): CSSProperties {
  return resolveStyleBox(ref, internalResources) ?? {};
}
