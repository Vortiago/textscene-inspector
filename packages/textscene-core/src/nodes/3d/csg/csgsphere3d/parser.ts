/** CSGSphere3D parser - parses CSGSphere3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGSphere3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { warn } from '../../../../logger';

/** Godot CSGSphere3D defaults. */
const DEFAULTS = { radius: 0.5, radialSegments: 12, rings: 6 } as const;

function numericOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseCSGSphere3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGSphere3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGSphere3DProperties = {
    ...node3d,
    radius: numericOr(properties.radius, DEFAULTS.radius),
    radialSegments: Math.round(numericOr(properties.radial_segments, DEFAULTS.radialSegments)),
    rings: Math.round(numericOr(properties.rings, DEFAULTS.rings)),
  };

  if (properties.material) {
    result.material = properties.material;
  }

  if (properties.operation !== undefined) {
    const operation = parseInt(properties.operation, 10);
    if (!Number.isNaN(operation)) {
      result.operation = operation;
      if (operation !== 0) {
        // ADR-0004: boolean ops are not applied; the node renders as its
        // solid base primitive. Warn so a subtraction/intersection that
        // renders "wrong" (a hole shows as a solid sphere) isn't silent.
        warn(
          `[CSGSphere3D] operation=${operation} (non-union) is ignored — ` +
            `rendering the base sphere primitive (ADR-0004).`
        );
      }
    }
  }

  return result;
}
