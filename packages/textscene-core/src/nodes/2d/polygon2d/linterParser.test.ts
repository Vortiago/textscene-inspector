/**
 * Tests for Polygon2D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

/** The diagnostics of one severity: the error and warning tiers are asserted apart. */
const ofSeverity = (severity: 'error' | 'warning') => (diagnostics: ReturnType<Linter['lint']>) =>
  diagnostics.filter((d) => d.severity === severity);

const errorsOf = ofSeverity('error');
const warningsOf = ofSeverity('warning');

describe('Polygon2D strict validators', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes the witnessed textured/inverted Polygon2D form', () => {
    const content = `[gd_scene format=3]

[node name="Polygon2DInvertedTextured" type="Polygon2D"]
texture_repeat = 2
position = Vector2(349, -416)
color = Color(1, 0.490196, 0.356863, 1)
antialiased = true
invert_enabled = true
invert_border = 20.0
texture_offset = Vector2(1.139, -21.764)
polygon = PackedVector2Array(65.3057, 508.435, 117.632, 527.527, 155.815, 517.627, 155.108, 478.029)
`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });

  it('rejects a malformed fill color', () => {
    const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
color = Color(1, 0, 0)
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('color');
  });

  it('rejects a non-boolean antialiased', () => {
    const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
antialiased = sometimes
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('antialiased');
  });

  it('rejects a malformed texture resource reference', () => {
    const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
texture = "not-a-resource"
`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('texture');
  });

  it('rejects a malformed polygon literal', () => {
    const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygon = "not-a-vector-array"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('polygon');
  });

  it('rejects a malformed vertex_colors literal', () => {
    const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nvertex_colors = "not-a-color-array"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('vertex_colors');
  });

  describe('polygons (sub-polygon index lists)', () => {
    it('passes a witnessed multi-sub-polygon form (scenes/fixtures/unit-2d-geometry-parity.tscn)', () => {
      const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)
polygons = [PackedInt32Array(0, 1, 2, 3), PackedInt32Array(4, 5, 6, 7)]
`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('passes an empty polygons array', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = []\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('rejects a polygons value that is not a bracket array', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = PackedInt32Array(0, 1, 2)\n`;
      const errors = errorsOf(linter.lint(content));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain('polygons');
    });

    it('rejects a polygons entry that is not PackedInt32Array', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedVector2Array(0, 0)]\n`;
      const errors = errorsOf(linter.lint(content));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain('polygons');
    });

    it('rejects a non-integer index inside a polygons entry', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedInt32Array(0, 1.5, 2)]\n`;
      const errors = errorsOf(linter.lint(content));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain('non-integer');
    });

    it('accepts a trailing comma before the closing bracket (variant_parser.cpp:1658 accepts it too)', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedInt32Array(0, 1, 2),]\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('accepts a bare [i0, i1, …] element, the second spelling _draw reads (polygon_2d.cpp:328 `Vector<int> src_indices = polygons[i]` implicitly casts ARRAY -> PACKED_INT32_ARRAY)', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [[0, 1, 2, 3]]\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('rejects a trailing comma INSIDE a PackedInt32Array(…) constructor call (variant_parser.cpp:571 demands a value after every comma it consumes, unlike the bracket literal around it)', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedInt32Array(0, 1, 2,)]\n`;
      const errors = errorsOf(linter.lint(content));
      expect(errors.length).toBeGreaterThan(0);
    });

    it('accepts a trailing comma inside a bare [i0, i1, …] element (same bracket grammar as the outer array)', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [[0, 1, 2,]]\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });
  });

  describe('internal_vertex_count', () => {
    // polygon_2d.cpp:722, PROPERTY_HINT_RANGE "0,1000" — closed both ends, no
    // or_greater. set_internal_vertex_count (polygon_2d.cpp:418-420) is a bare
    // assignment, so out-of-hint warns and never errors. The endpoint-accept
    // cases below have to check WARNINGS, not just errors: a drifted ceiling
    // would still leave the error list empty.
    function diagnose(value: string) {
      return linter.lint(
        `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\ninternal_vertex_count = ${value}\n`
      );
    }

    it.each(['0', '1000'])('accepts the hint endpoint %s in silence', (value) => {
      const diagnostics = diagnose(value);
      expect(errorsOf(diagnostics)).toEqual([]);
      expect(warningsOf(diagnostics).some((w) => w.message.includes('internal_vertex_count'))).toBe(
        false
      );
    });

    it.each(['-1', '1001'])('warns, and never errors, one step past the hint at %s', (value) => {
      const diagnostics = diagnose(value);
      expect(errorsOf(diagnostics)).toEqual([]);
      expect(warningsOf(diagnostics).some((w) => w.message.includes('internal_vertex_count'))).toBe(
        true
      );
    });
  });

  describe('bones (skinning weight table)', () => {
    it('passes a witnessed bones form (scenes/demos/2d/skeleton/player/player.tscn)', () => {
      const content = `[gd_scene format=3]

[node name="P" type="Polygon2D"]
skeleton = NodePath("../../Skeleton2D")
bones = ["Hip", PackedFloat32Array(0, 0, 0), "Hip/Chest", PackedFloat32Array(1, 1, 1)]
`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('passes an empty bones array', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nbones = []\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('rejects a bones value that is not a bracket array', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nbones = "Hip"\n`;
      const errors = errorsOf(linter.lint(content));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain('bones');
    });

    it('errors on an odd element count (polygon_2d.cpp:589, ERR_FAIL_COND drops the write)', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nbones = ["Hip", PackedFloat32Array(0, 0, 0), "Orphan"]\n`;
      const found = linter.lint(content).find((d) => d.message.includes('bones'));
      expect(found?.severity).toBe('error');
      expect(found?.message).toContain('even element count');
    });

    it('accepts a trailing comma before the closing bracket without miscounting as odd', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nbones = ["Hip", PackedFloat32Array(0, 0, 0),]\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });
  });

  it('rejects a malformed skeleton NodePath', () => {
    const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nskeleton = "../Skeleton2D"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('skeleton');
  });

  it('accepts NodePath("…"), the witnessed skeleton spelling (scenes/demos/2d/skeleton/player/player.tscn, polygon_2d.cpp:710 NODE_PATH + NODE_PATH_VALID_TYPES "Skeleton2D")', () => {
    const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nskeleton = NodePath("../../Skeleton2D")\n`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });
});
