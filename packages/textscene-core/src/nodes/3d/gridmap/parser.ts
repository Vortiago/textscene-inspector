/**
 * GridMap parser — extends Node3D with the mesh library reference, cell size,
 * and the raw cell stream. The `data` property is a Godot dictionary
 * `{ "cells": PackedInt32Array(...) }`; we extract the PackedInt32Array body
 * for the cell decoder.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import type { GridMapProperties } from './types';

const DEFAULT_CELL_SIZE: Vector3 = { x: 2, y: 2, z: 2 };

/** Pull the int body out of `... "cells": PackedInt32Array( <body> ) ...`. */
function extractCells(dataProperty: string | undefined): string {
  if (!dataProperty) return '';
  const match = /"cells"\s*:\s*PackedInt32Array\(([^)]*)\)/.exec(dataProperty);
  return match ? match[1]!.trim() : '';
}

export function parseGridMap(
  heading: ParsedHeading,
  properties: Record<string, string>
): GridMapProperties {
  const baseProperties = parseNode3D(heading, properties);

  let cellSize = DEFAULT_CELL_SIZE;
  if (properties.cell_size) {
    try {
      cellSize = parseVector3(properties.cell_size);
    } catch {
      cellSize = DEFAULT_CELL_SIZE;
    }
  }

  return {
    ...baseProperties,
    meshLibrary: properties.mesh_library,
    cellSize,
    cells: extractCells(properties.data),
  };
}
