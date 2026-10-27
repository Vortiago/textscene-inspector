/**
 * Triangulates a glyph's contours: each outer contour with the holes inside it, as triangles with
 * their corners in the order a front face needs. Godot partitions the glyph with polypartition
 * (`primitive_meshes.cpp:3175-3194`); any triangulation fills the same region, and the mesh takes
 * its UV from the positions, so the triangle layout never shows.
 */

import * as THREE from 'three';
import { signedPolygonArea } from '../../../godot/math/polygonArea';
import type { Vector2 } from '../../../godot/math/vector';

/** Whether `point` lies inside `polygon`, by a ray to the right. */
function containsPoint(polygon: readonly Vector2[], point: Vector2): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      isInside = !isInside;
    }
  }
  return isInside;
}

/** The size of a polygon's area, whichever way it winds. */
function polygonArea(polygon: readonly Vector2[]): number {
  return Math.abs(signedPolygonArea(polygon));
}

/** A contour to triangulate, and whether it bounds a hole in the contour that holds it. */
export interface TriangulatedContour {
  points: readonly Vector2[];
  isHole: boolean;
}

/** The holes of each outer contour: a hole belongs to the smallest outer contour that contains it. */
function holesByOuter(outers: readonly (readonly Vector2[])[], holes: readonly (readonly Vector2[])[]) {
  const holesOf = outers.map(() => [] as (readonly Vector2[])[]);
  const outerAreas = outers.map(polygonArea);
  for (const hole of holes) {
    let owner = -1;
    outers.forEach((outer, i) => {
      if (containsPoint(outer, hole[0]!) && (owner < 0 || outerAreas[i]! < outerAreas[owner]!)) owner = i;
    });
    if (owner >= 0) holesOf[owner]!.push(hole);
  }
  return holesOf;
}

const toThree = (points: readonly Vector2[]) => points.map(({ x, y }) => new THREE.Vector2(x, y));

/** The triangles of one outer contour and the holes inside it, as corners that wind counter-clockwise. */
function fillContour(outer: readonly Vector2[], holes: readonly (readonly Vector2[])[]): Vector2[] {
  const contour = toThree(outer);
  const holeContours = holes.map(toThree);
  const triangles = THREE.ShapeUtils.triangulateShape(contour, holeContours);
  // `triangulateShape` drops a closing point equal to the first, so its indices run over what is left.
  const corners = [...contour, ...holeContours.flat()];
  return triangles.flatMap(([a, b, c]) => {
    const triangle = [corners[a!]!, corners[b!]!, corners[c!]!] as const;
    return signedPolygonArea(triangle) < 0 ? [triangle[0], triangle[2], triangle[1]] : [...triangle];
  });
}

/**
 * The triangles that fill the region the contours bound, three points to a triangle, each wound so
 * that its signed area is positive.
 */
export function triangulateContours(contours: readonly TriangulatedContour[]): Vector2[] {
  const outers = contours.filter((contour) => !contour.isHole).map((contour) => contour.points);
  const holes = contours.filter((contour) => contour.isHole).map((contour) => contour.points);
  const holesOf = holesByOuter(outers, holes);
  return outers.flatMap((outer, i) => fillContour(outer, holesOf[i]!));
}
