/**
 * Shapes and the debug-line vertices Godot 4.6.3 gives for each, read back from `get_debug_mesh()`.
 * The shape tests and the CollisionShape3D gizmo tests share them. A ConvexPolygonShape3D case keeps
 * Godot's edge order, so compare its edges as a set.
 */

import type { Shape3DClass, Shape3DResource } from '../../../resources/shapes/shape3d';
import fixture from './godotDebugLines.fixture.json';

export interface GodotDebugLinesCase {
  name: string;
  shape: Shape3DResource;
  /** Flat `x, y, z` vertices, two per segment, in Godot's order. */
  lines: number[];
}

interface FixtureEntry extends Omit<GodotDebugLinesCase, 'shape'> {
  type: Shape3DClass;
  data: Record<string, string>;
}

/** The measured cases of one shape type. */
export function godotDebugLinesFor(type: Shape3DClass): GodotDebugLinesCase[] {
  // The JSON import types `data` as a union of object shapes, which no string record accepts.
  const entries = fixture as unknown as FixtureEntry[];
  return entries
    .filter((entry) => entry.type === type)
    .map(({ name, data, lines }) => ({ name, shape: { type, data }, lines }));
}

/** The segments of flat `lines` as a sorted list of undirected edges, so a test ignores the order. */
export function undirectedEdges(lines: ArrayLike<number>): string[] {
  const vertices: string[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const [x, y, z] = [lines[i]!, lines[i + 1]!, lines[i + 2]!];
    vertices.push([x, y, z].map((value) => (value + 0).toFixed(4)).join(' '));
  }
  const edges: string[] = [];
  for (let i = 0; i + 1 < vertices.length; i += 2)
    edges.push([vertices[i], vertices[i + 1]].sort().join(' | '));
  return edges.sort();
}
