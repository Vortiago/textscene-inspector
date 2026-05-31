/**
 * Resolve a Control's StyleBox theme override (e.g. `theme_override_styles/panel
 * = SubResource("StyleBoxFlat_x")`) to CSS. Looks up the referenced sub-resource
 * and maps it via styleBoxToCss. Returns `{}` for missing/unresolved refs.
 * Used by the StyleBox-bearing Controls (Panel, PanelContainer, Button).
 */

import type { CSSProperties } from 'react';
import type { TscnInternalResource } from '../../parser/types';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { findSubResource } from '../SceneResourcesContext';
import { styleBoxToCss } from './styleBoxToCss';

export function resolveStyleBoxCss(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): CSSProperties {
  if (!ref) return {};
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return {};
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource) return {};
  return styleBoxToCss(resource.type, resource.data as Record<string, string>);
}
