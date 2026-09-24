/**
 * The cell-position math of `GraphEdit::_draw_grid` (`scene/gui/graph_edit.cpp:1895-1964`). Colour
 * and alpha belong to the painter, which alone holds the resolved `grid_major` and `grid_minor`
 * theme colours that the alpha gates read.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';

// Two constants, not one: lines take a major every 10 minor steps and dots every 5 (`:55-56`).
const GRID_MINOR_STEPS_PER_MAJOR_LINE = 10;
const GRID_MINOR_STEPS_PER_MAJOR_DOT = 5;

/** `GraphEdit::GridPattern` (`graph_edit.h:146-149`). */
export const GRID_PATTERN_LINES = 0;
export const GRID_PATTERN_DOTS = 1;

interface GridExtent {
  fromX: number;
  fromY: number;
  lenX: number;
  lenY: number;
  /** `offset * zoom`: the screen-space shift each cell position subtracts, per axis. */
  offsetX: number;
  offsetY: number;
}

/** `graph_edit.cpp:1896-1900`: `offset = scroll_offset / zoom`, `size = get_size() / zoom`, both floored per axis before the loop bounds. */
function computeExtent(rectSize: Vec2, scrollOffset: Vec2, zoom: number, snappingDistance: number): GridExtent {
  const offsetGraphX = scrollOffset.x / zoom;
  const offsetGraphY = scrollOffset.y / zoom;
  const sizeGraphX = rectSize.x / zoom;
  const sizeGraphY = rectSize.y / zoom;

  return {
    fromX: Math.floor(offsetGraphX / snappingDistance),
    fromY: Math.floor(offsetGraphY / snappingDistance),
    lenX: Math.floor(sizeGraphX / snappingDistance) + 1,
    lenY: Math.floor(sizeGraphY / snappingDistance) + 1,
    offsetX: offsetGraphX * zoom,
    offsetY: offsetGraphY * zoom,
  };
}

export interface GridLine {
  axis: 'vertical' | 'horizontal';
  /** Screen-space X (vertical line) or Y (horizontal line), local to GraphEdit's own top-left. */
  at: number;
  major: boolean;
}

/** `GRID_PATTERN_LINES` branch (`:1903-1929`). */
export function computeGridLines(
  rectSize: Vec2,
  scrollOffset: Vec2,
  zoom: number,
  snappingDistance: number
): GridLine[] {
  const e = computeExtent(rectSize, scrollOffset, zoom, snappingDistance);
  const lines: GridLine[] = [];

  for (let i = e.fromX; i < e.fromX + e.lenX; i++) {
    const major = Math.abs(i) % GRID_MINOR_STEPS_PER_MAJOR_LINE === 0;
    lines.push({ axis: 'vertical', at: i * snappingDistance * zoom - e.offsetX, major });
  }
  for (let i = e.fromY; i < e.fromY + e.lenY; i++) {
    const major = Math.abs(i) % GRID_MINOR_STEPS_PER_MAJOR_LINE === 0;
    lines.push({ axis: 'horizontal', at: i * snappingDistance * zoom - e.offsetY, major });
  }
  return lines;
}

export interface GridDot {
  /** Screen-space centre, local to GraphEdit's own top-left. */
  x: number;
  y: number;
}

export interface GridDots {
  minor: GridDot[];
  major: GridDot[];
}

/** `GRID_PATTERN_DOTS` branch's cell positions (`:1930-1962`), colour/alpha left to the caller. */
export function computeGridDots(
  rectSize: Vec2,
  scrollOffset: Vec2,
  zoom: number,
  snappingDistance: number
): GridDots {
  const e = computeExtent(rectSize, scrollOffset, zoom, snappingDistance);
  const minor: GridDot[] = [];
  for (let i = e.fromX; i < e.fromX + e.lenX; i++) {
    for (let j = e.fromY; j < e.fromY + e.lenY; j++) {
      if (Math.abs(i) % GRID_MINOR_STEPS_PER_MAJOR_DOT === 0 && Math.abs(j) % GRID_MINOR_STEPS_PER_MAJOR_DOT === 0) {
        continue;
      }
      minor.push({ x: i * snappingDistance * zoom - e.offsetX, y: j * snappingDistance * zoom - e.offsetY });
    }
  }

  const major: GridDot[] = [];
  const startI = e.fromX - (e.fromX % GRID_MINOR_STEPS_PER_MAJOR_DOT);
  const startJ = e.fromY - (e.fromY % GRID_MINOR_STEPS_PER_MAJOR_DOT);
  for (let i = startI; i < e.fromX + e.lenX; i += GRID_MINOR_STEPS_PER_MAJOR_DOT) {
    for (let j = startJ; j < e.fromY + e.lenY; j += GRID_MINOR_STEPS_PER_MAJOR_DOT) {
      major.push({ x: i * snappingDistance * zoom - e.offsetX, y: j * snappingDistance * zoom - e.offsetY });
    }
  }

  return { minor, major };
}
