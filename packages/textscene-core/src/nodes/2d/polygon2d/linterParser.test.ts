/**
 * Tests for Polygon2D strict validators (format validation).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
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

    // `null` is a legal element of any untyped Array, and `set_polygons`
    // assigns one bare (polygon_2d.cpp:435-437). `_draw` reads the entry into
    // an empty `Vector<int>` and skips it at `ic < 3` (:328-330), so it draws
    // nothing and refuses nothing. Four scraped-corpus files carry one.
    it('accepts a null entry, which the untyped Array setter stores', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedInt32Array(0, 1, 2), null]\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    // `_parse_construct<int32_t>` (variant_parser.cpp:1428-1430) takes any
    // number token and narrows it, so Godot loads this as index 1.
    it('truncates a float index rather than refusing it', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedInt32Array(0, 1.5, 2)]\n`;
      expect(errorsOf(linter.lint(content))).toEqual([]);
    });

    it('still rejects an index Godot cannot tokenise at all', () => {
      const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\npolygons = [PackedInt32Array(0, 1abc, 2)]\n`;
      const errors = errorsOf(linter.lint(content));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain('non-numeric');
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

  describe('invert_border', () => {
    // polygon_2d.cpp:714, PROPERTY_HINT_RANGE "0.1,16384,0.1,suffix:px" —
    // closed both ends. set_invert_border (polygon_2d.cpp:516-517) is a bare
    // assignment, so out-of-hint warns and never errors.
    function diagnose(value: string) {
      return linter.lint(
        `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\ninvert_border = ${value}\n`
      );
    }

    it.each(['0.1', '16384', '100.0'])('accepts %s in silence', (value) => {
      // 100.0 is the engine default (polygon_2d.h:61), so it must stay silent too.
      const diagnostics = diagnose(value);
      expect(errorsOf(diagnostics)).toEqual([]);
      expect(warningsOf(diagnostics).some((w) => w.message.includes('invert_border'))).toBe(false);
    });

    it.each(['0.0', '16384.1'])('warns, and never errors, one step past the hint at %s', (value) => {
      const diagnostics = diagnose(value);
      expect(errorsOf(diagnostics)).toEqual([]);
      expect(warningsOf(diagnostics).some((w) => w.message.includes('invert_border'))).toBe(true);
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

  // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
  it('rejects a StringName skeleton', () => {
    const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nskeleton = &"../Skeleton2D"\n`;
    const errors = errorsOf(linter.lint(content));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('skeleton');
  });

  it('accepts NodePath("…"), the witnessed skeleton spelling (scenes/demos/2d/skeleton/player/player.tscn, polygon_2d.cpp:710 NODE_PATH + NODE_PATH_VALID_TYPES "Skeleton2D")', () => {
    const content = `[gd_scene format=3]\n\n[node name="P" type="Polygon2D"]\nskeleton = NodePath("../../Skeleton2D")\n`;
    expect(errorsOf(linter.lint(content))).toEqual([]);
  });
});

describe('Polygon2D.polygons in the typed-array spelling', () => {
  const polygons = (value: string) =>
    validatorRegistry.findValidator('Polygon2D', 'polygons')!('polygons', value, 1);

  it('takes the typed wrapper, which is an Array like any other', () => {
    // polygon_2d.cpp:720 declares `polygons` Variant::ARRAY and :435-437 assigns
    // it bare, so `Array[PackedInt32Array]([…])` loads unchanged — and this
    // repo's own reader already renders those holes.
    expect(polygons('Array[PackedInt32Array]([PackedInt32Array(0, 1, 2)])')).toBeNull();
    expect(polygons('Array[PackedInt32Array]([[0, 1, 2], [0, 2, 3]])')).toBeNull();
  });

  it('still takes the bare spellings', () => {
    expect(polygons('[PackedInt32Array(0, 1, 2)]')).toBeNull();
    expect(polygons('[[0, 1, 2]]')).toBeNull();
    expect(polygons('[]')).toBeNull();
  });

  it('still refuses a value that is no array at all', () => {
    expect(polygons('PackedInt32Array(0, 1, 2)')?.code).toBe('INVALID_POLYGONS_FORMAT');
  });
});
