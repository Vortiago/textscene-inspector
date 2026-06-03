/** CSGCylinder3D parser - parses CSGCylinder3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGCylinder3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { warn } from '../../../../logger';

const DEFAULTS = { radius: 1, height: 1, sides: 8, cone: false } as const;

function numericOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseCSGCylinder3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGCylinder3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGCylinder3DProperties = {
    ...node3d,
    radius: numericOr(properties.radius, DEFAULTS.radius),
    height: numericOr(properties.height, DEFAULTS.height),
    sides: Math.round(numericOr(properties.sides, DEFAULTS.sides)),
    cone: properties.cone === undefined ? DEFAULTS.cone : properties.cone === 'true',
  };

  if (properties.material) {
    result.material = properties.material;
  }

  if (properties.operation !== undefined) {
    const operation = parseInt(properties.operation, 10);
    if (!Number.isNaN(operation)) {
      result.operation = operation;
      if (operation !== 0) {
        warn(
          `[CSGCylinder3D] operation=${operation} (non-union) is ignored — ` +
            `rendering the base cylinder primitive (ADR-0004).`
        );
      }
    }
  }

  return result;
}
