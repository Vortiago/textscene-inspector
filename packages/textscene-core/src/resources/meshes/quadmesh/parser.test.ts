import { describe, expect, it } from 'vitest';
import { parseQuadMesh } from './parser';

describe('parseQuadMesh', () => {
  it('defaults to a 1×1 quad facing +Z (FACE_Z orientation) when no props given', () => {
    const props = parseQuadMesh({});
    expect(props.size).toEqual({ x: 1, y: 1 });
    expect(props.orientation).toBe(2);
  });

  it('parses size from the witnessed Vector2(200, 200) form', () => {
    const props = parseQuadMesh({ size: 'Vector2(200, 200)' });
    expect(props.size).toEqual({ x: 200, y: 200 });
  });

  it('reuses PlaneMesh field reading (subdivide_*, center_offset, flip_faces)', () => {
    const props = parseQuadMesh({
      subdivide_width: '2',
      subdivide_depth: '3',
      center_offset: 'Vector3(1, 2, 3)',
      flip_faces: 'true',
    });
    expect(props.subdivideWidth).toBe(2);
    expect(props.subdivideDepth).toBe(3);
    expect(props.centerOffset).toEqual({ x: 1, y: 2, z: 3 });
    expect(props.flipFaces).toBe(true);
  });

  it('tolerates a malformed size by falling back to the 1×1 default', () => {
    const props = parseQuadMesh({ size: 'not-a-vector' });
    expect(props.size).toEqual({ x: 1, y: 1 });
  });

  it('falls back to the QuadMesh FACE_Z (2) default on an out-of-range orientation', () => {
    // Regression: the invalid-orientation branch must honor the caller's default,
    // not revert to PlaneMesh's FACE_Y (1).
    expect(parseQuadMesh({ orientation: '7' }).orientation).toBe(2);
    expect(parseQuadMesh({ orientation: 'foo' }).orientation).toBe(2);
  });
});
