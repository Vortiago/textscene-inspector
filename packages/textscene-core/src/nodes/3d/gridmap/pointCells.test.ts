import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pointsAtCells } from './pointCells';

/** Two points, drawn in reverse order by an index, in two groups of one point. */
function twoPoints(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0]), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0]), 3));
  geometry.setIndex([1, 0]);
  geometry.addGroup(0, 1, 0);
  geometry.addGroup(1, 1, 1);
  geometry.userData = { marker: true };
  return geometry;
}

const moved = (x: number) => new THREE.Matrix4().makeTranslation(x, 0, 0);

describe('pointsAtCells', () => {
  it('moves the points of each cell with its matrix', () => {
    const position = pointsAtCells(twoPoints(), [moved(10), moved(20)]).getAttribute('position');

    expect(Array.from(position.array)).toEqual([10, 0, 0, 11, 0, 0, 20, 0, 0, 21, 0, 0]);
  });

  it('turns the normals of each cell and leaves the rest of its attributes as they are', () => {
    const halfTurn = new THREE.Matrix4().makeRotationY(Math.PI);
    const merged = pointsAtCells(twoPoints(), [new THREE.Matrix4(), halfTurn]);

    const normals = Array.from(merged.getAttribute('normal').array).map((n) => Math.round(n));
    expect(normals).toEqual([0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1]);
    expect(Array.from(merged.getAttribute('color').array)).toEqual([1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0]);
  });

  it('keeps the draw order inside each group by offsetting each cell’s index', () => {
    const merged = pointsAtCells(twoPoints(), [moved(0), moved(1)]);

    expect(Array.from(merged.index!.array)).toEqual([1, 3, 0, 2]);
  });

  // One range per group, so a surface costs one draw call however many cells hold it.
  it('spans every cell with each draw group', () => {
    const merged = pointsAtCells(twoPoints(), [moved(0), moved(1)]);

    expect(merged.groups).toEqual([
      { start: 0, count: 2, materialIndex: 0 },
      { start: 2, count: 2, materialIndex: 1 },
    ]);
  });

  it('draws a source with no index and no groups once for each cell (edge case)', () => {
    const source = twoPoints();
    source.setIndex(null);
    source.clearGroups();

    const merged = pointsAtCells(source, [moved(0), moved(1)]);

    expect(Array.from(merged.index!.array)).toEqual([0, 1, 2, 3]);
    expect(merged.groups).toEqual([]);
  });

  it('keeps what marks the geometry as points', () => {
    expect(pointsAtCells(twoPoints(), [moved(0)]).userData).toEqual({ marker: true });
  });

  it('leaves the source geometry as it was (edge case)', () => {
    const source = twoPoints();
    pointsAtCells(source, [moved(5)]);

    expect(Array.from(source.getAttribute('position').array)).toEqual([0, 0, 0, 1, 0, 0]);
  });

  it('holds no vertex for no cell (edge case)', () => {
    expect(pointsAtCells(twoPoints(), []).getAttribute('position').count).toBe(0);
  });
});
