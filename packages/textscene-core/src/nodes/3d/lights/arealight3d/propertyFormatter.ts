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

function parseAreaSize(raw: string | undefined | null): [number, number] {
  if (!raw) return [1, 1];
  const m = raw.match(/Vector2\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
  if (!m || !m[1] || !m[2]) return [1, 1];
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return [isFinite(w) ? w : 1, isFinite(h) ? h : 1];
}

export function formatAreaLight3DProperties(properties: AreaLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];
  const [w, h] = parseAreaSize(properties.area_size);

  const areaLightItems: PropertySection['items'] = [
    { label: 'Size', value: `${w} × ${h}` },
  ];

  sections.push(formatBaseLightSection(properties, areaLightItems));

  const shadowItems: PropertySection['items'] = [];
  sections.push(formatShadowSectionWithNormalBias(properties, shadowItems));

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
