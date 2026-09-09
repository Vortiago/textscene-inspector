/**
 * GridMap parser — extends Node3D with the mesh library reference, cell size,
 * and the raw cell stream. The `data` property is a Godot dictionary
 * `{ "cells": PackedInt32Array(...) }`; we extract the PackedInt32Array body
 * for the cell decoder.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { boolOr } from '../../../parser/valueParsers';
import type { GridMapProperties } from './types';
import { packedArrayCallAnywhere } from '../../../godot/index.js';

/** The `"cells"` entry of GridMap's packed data Dictionary. */
const CELLS_RE = new RegExp(`"cells"\\s*:\\s*${packedArrayCallAnywhere('PackedInt32Array').source}`);

const DEFAULT_CELL_SIZE: Vector3 = { x: 2, y: 2, z: 2 };

/**
 * Shared instance for the all-centered default, the same way DEFAULT_CELL_SIZE
 * is shared. Re-parsing (every debounced keystroke in the Source pane) must not
 * hand the renderer a fresh object for unchanged properties: the GridMap's
 * instance-matrix memo keys on these, and a new identity there rebuilds every
 * cell matrix and the InstancedMesh's GPU buffer.
 */
const DEFAULT_CELL_CENTER = Object.freeze({ x: true, y: true, z: true });

/** Pull the int body out of `... "cells": PackedInt32Array( <body> ) ...`. */
function extractCells(dataProperty: string | undefined): string {
  if (!dataProperty) return '';
  const match = CELLS_RE.exec(dataProperty);
  return match ? match[1]!.trim() : '';
}

/**
 * Godot defaults every axis to centered and only writes the property when it is
 * turned OFF, so an absent key means true. Returns the shared default instance
 * when nothing is overridden — see DEFAULT_CELL_CENTER.
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
