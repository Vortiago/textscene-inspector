/**
 * GridMap parser: the Node3D surface plus the mesh library reference, cell size
 * and the PackedInt32Array body of `data = { "cells": PackedInt32Array(...) }`.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { boolOr } from '../../../parser/valueParsers';
import type { GridMapProperties } from './types';
import { CELLS_FIELD_RE } from './cellData.js';

const DEFAULT_CELL_SIZE: Vector3 = { x: 2, y: 2, z: 2 };

/**
 * Shared all-centred default, like DEFAULT_CELL_SIZE. The instance-matrix memo
 * keys on its identity, so a fresh object per parse (every debounced keystroke)
 * would rebuild every cell matrix and the InstancedMesh's GPU buffer.
 */
const DEFAULT_CELL_CENTER = Object.freeze({ x: true, y: true, z: true });

/** Pull the int body out of `... "cells": PackedInt32Array( <body> ) ...`. */
function extractCells(dataProperty: string | undefined): string {
  if (!dataProperty) return '';
  const match = CELLS_FIELD_RE.exec(dataProperty);
  return match ? match[1]!.trim() : '';
}

/**
 * Godot defaults every axis to centred and writes the property only when it is
 * off, so an absent key means true. Nothing overridden returns
 * DEFAULT_CELL_CENTER.
 */
function parseCellCenter(
  properties: Record<string, string>
): GridMapProperties['cellCenter'] {
  if (
    properties.cell_center_x === undefined &&
    properties.cell_center_y === undefined &&
    properties.cell_center_z === undefined
  ) {
    return DEFAULT_CELL_CENTER;
  }
  return {
    x: boolOr(properties.cell_center_x, true, 'GridMap.cell_center_x'),
    y: boolOr(properties.cell_center_y, true, 'GridMap.cell_center_y'),
    z: boolOr(properties.cell_center_z, true, 'GridMap.cell_center_z'),
  };
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
    cellCenter: parseCellCenter(properties),
    cells: extractCells(properties.data),
  };
}
