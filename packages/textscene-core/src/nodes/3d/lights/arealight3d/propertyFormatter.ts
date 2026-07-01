/**
 * AreaLight3D property formatter - formats area light properties for display.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { AreaLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import {
  formatBaseLightSection,
  formatShadowSectionWithNormalBias,
} from '../shared/propertyFormatter';

export function formatAreaLight3DProperties(properties: AreaLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];
  // area_size is already parsed to {x, y} in the parser (via the canonical
  // parseVector2), so the inspector reads the numbers directly — same source
  // of truth as the render path, no per-consumer re-parse.
  const { x: w, y: h } = properties.area_size ?? { x: 1, y: 1 };

  const areaLightItems: PropertySection['items'] = [
    { label: 'Size', value: `${w} × ${h}` },
  ];

  sections.push(formatBaseLightSection(properties, areaLightItems));

  // No area-light-specific shadow rows: RectAreaLight has no shadow support,
  // so shadow_* is intentionally lossy at render (see Component.tsx). The
  // shared Shadows section is still shown for parity with sibling lights.
  sections.push(formatShadowSectionWithNormalBias(properties));

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
