/**
 * `styleBoxFlatGeometry` against `StyleBoxFlat::draw` and `draw_rounded_rectangle`
 * in `scene/resources/style_box_flat.cpp` (Godot 4.6.3). Every expected vertex is
 * hand-derived from the cited source, never a re-run of this module's code.
 */
// `box()` defaults to `antiAliased: false`, zero skew and zero shadow. The AA, skew,
// shadow and ring-triangulation blocks override it. The AA fixtures trace `draw()`'s `aa_on`
// block (style_box_flat.cpp:511-630) with an oversampling of 1
// (style_box_flat.cpp:499-502), so `aa_size_scaled == aa_size`.
import { describe, expect, it } from 'vitest';
import { styleBoxFlatGeometry } from './styleBoxFlatGeometry';
import type { StyleBoxFlatData } from './styleBoxFlat';

const RED = { r: 1, g: 0, b: 0, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function box(overrides: Partial<StyleBoxFlatData>): StyleBoxFlatData {
  return {
    bgColor: RED,
    borderColor: GREEN,
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin: { ...ZERO_SIDES },
    drawCenter: true,
    borderBlend: false,
    // Every non-AA fixture opts out explicitly.
    antiAliased: false,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('styleBoxFlatGeometry', () => {
  it('a sharp rect (no radius, no border): 8 duplicated-corner vertices, 6 triangles, all bg_color', () => {
    // No border and no radius: adapted_corner_detail = 1, so ring_vert_count =
    // 4 * (1+1) = 8, the 4 rect corners each written twice. stripes_count = 3,
    // so 18 indices: two stripes are zero-area and the middle one splits the
    // rect along its diagonal.
    const geo = styleBoxFlatGeometry(box({}), { x: 0, y: 0, w: 100, h: 50 });

    expect(geo.positions).toHaveLength(8 * 3);
    expect(geo.indices).toHaveLength(18);
    expect(geo.colors).toHaveLength(8 * 4);

    const corners = [
      [0, 0],
      [0, 0],
      [100, 0],
      [100, 0],
      [100, 50],
      [100, 50],
      [0, 50],
      [0, 50],
    ];
    for (let i = 0; i < 8; i++) {
      expect(geo.positions[i * 3]).toBeCloseTo(corners[i]![0]!);
      expect(geo.positions[i * 3 + 1]).toBeCloseTo(corners[i]![1]!);
      expect(geo.positions[i * 3 + 2]).toBe(0);
      expect(geo.colors.slice(i * 4, i * 4 + 4)).toEqual([RED.r, RED.g, RED.b, RED.a]);
    }
  });

  it('a uniform corner radius: 36 vertices (corner_detail=8), rounded-corner landmark positions', () => {
    // Radius 10 on a 100x50 rect does not overflow, so scale = 1. Detail 8 gives
    // 9 points per corner, 36 vertices, not doubled without a border. TL (centre
    // (10,10)) sweeps PI..3PI/2 from (0,10) to (10,0), and TR (centre (90,10))
    // sweeps 3PI/2..2PI from (90,0) to (100,10).
    const geo = styleBoxFlatGeometry(
      box({ cornerRadius: { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 } }),
      { x: 0, y: 0, w: 100, h: 50 }
    );

    expect(geo.positions).toHaveLength(36 * 3);
    expect(geo.colors).toHaveLength(36 * 4);

    const tlFirst = 0;
    const tlLast = 8;
    expect(geo.positions[tlFirst * 3]).toBeCloseTo(0);
    expect(geo.positions[tlFirst * 3 + 1]).toBeCloseTo(10);
    expect(geo.positions[tlLast * 3]).toBeCloseTo(10);
    expect(geo.positions[tlLast * 3 + 1]).toBeCloseTo(0);

    const trFirst = 9;
    const trLast = 17;
    expect(geo.positions[trFirst * 3]).toBeCloseTo(90);
    expect(geo.positions[trFirst * 3 + 1]).toBeCloseTo(0);
    expect(geo.positions[trLast * 3]).toBeCloseTo(100);
    expect(geo.positions[trLast * 3 + 1]).toBeCloseTo(10);

    for (let i = 0; i < 36; i++) {
      expect(geo.colors.slice(i * 4, i * 4 + 4)).toEqual([RED.r, RED.g, RED.b, RED.a]);
    }
  });

  it('per-corner radii: each corner arcs around its OWN centre/radius, corner_detail stays 8 even where a corner is sharp', () => {
    // Radii TL=10 TR=20 BR=5 BL=0 on 100x100 do not overlap, so scale = 1. One
    // radius > 0 sets adapted_corner_detail = 8 for all corners, so the sharp BL
    // corner still gets 9 duplicated points.
    const geo = styleBoxFlatGeometry(
      box({ cornerRadius: { topLeft: 10, topRight: 20, bottomRight: 5, bottomLeft: 0 } }),
      { x: 0, y: 0, w: 100, h: 100 }
    );

    expect(geo.positions).toHaveLength(36 * 3);

    const at = (i: number, expected: [number, number]) => {
      expect(geo.positions[i * 3]).toBeCloseTo(expected[0]);
      expect(geo.positions[i * 3 + 1]).toBeCloseTo(expected[1]);
    };
    at(0, [0, 10]); // TL first, centre (10,10)
    at(8, [10, 0]); // TL last
    at(9, [80, 0]); // TR first, centre (80,20)
    at(17, [100, 20]); // TR last
    at(18, [100, 95]); // BR first, centre (95,95)
    at(26, [95, 100]); // BR last
    at(27, [0, 100]); // BL first, centre (0,100)
    at(35, [0, 100]); // BL last (duplicate, radius 0)
  });

  it('a border with border_blend: inner (fill-boundary) ring vertices carry bg_color, outer vertices carry border_color', () => {
    // With draw_center and border_blend, border_color_inner is bg_color
    // (style_box_flat.cpp:475-477): the ring's inner edge is bg_color, its outer
    // edge border_color, and vertex-colour interpolation blends them.
    const geo = styleBoxFlatGeometry(
      box({
        borderWidth: { left: 5, top: 5, right: 5, bottom: 5 },
        borderBlend: true,
      }),
      { x: 0, y: 0, w: 100, h: 50 }
    );

    // draw_rounded_rectangle for the border ring: adapted_corner_detail = 1
    // (no radius), draw_border = true -> ring_vert_count = 4*(1+1)*2 = 16,
    // vertices alternate inner (idx even), outer (idx odd) per detail step.
    const ring = { positions: geo.positions.slice(0, 16 * 3), colors: geo.colors.slice(0, 16 * 4) };
    for (let i = 0; i < 16; i += 2) {
      expect(ring.colors.slice(i * 4, i * 4 + 4)).toEqual([RED.r, RED.g, RED.b, RED.a]); // inner -> bg_color
      expect(ring.colors.slice((i + 1) * 4, (i + 1) * 4 + 4)).toEqual([GREEN.r, GREEN.g, GREEN.b, GREEN.a]); // outer -> border_color
    }
    // The border ring's own vertices span the [0,100]x[0,50] outer edge and
    // the [5,95]x[5,45] inner (infill) edge.
    expect(Math.min(...[...ring.positions].filter((_, idx) => idx % 3 === 0))).toBeCloseTo(0);
    expect(Math.max(...[...ring.positions].filter((_, idx) => idx % 3 === 0))).toBeCloseTo(100);
  });

  it('draw_center: false produces the border ring but no interior/centre-fill triangles', () => {
    // Without draw_center, style_box_flat.cpp::draw skips the centre fill
    // (`if (draw_center && ...)`), so only the border ring's 16 vertices * 3 =
    // 48 indices remain.
    const geo = styleBoxFlatGeometry(
      box({
        borderWidth: { left: 5, top: 5, right: 5, bottom: 5 },
        drawCenter: false,
      }),
      { x: 0, y: 0, w: 100, h: 50 }
    );

    expect(geo.positions).toHaveLength(16 * 3);
    expect(geo.colors).toHaveLength(16 * 4);
    expect(geo.indices).toHaveLength(48);
    // Every colour is border_color: without border_blend, border_color_inner
    // is border_color (style_box_flat.cpp:475-477).
    for (let i = 0; i < 16; i++) {
      expect(geo.colors.slice(i * 4, i * 4 + 4)).toEqual([GREEN.r, GREEN.g, GREEN.b, GREEN.a]);
    }
  });

  it('draw_center: false and no border produces no geometry at all', () => {
    // style_box_flat.cpp::draw: `if (!draw_border && !draw_center &&
    // !draw_shadow) return;`, so with no border and no shadow nothing is drawn.
    const geo = styleBoxFlatGeometry(box({ drawCenter: false }), { x: 0, y: 0, w: 100, h: 50 });
    expect(geo.positions).toHaveLength(0);
    expect(geo.indices).toHaveLength(0);
    expect(geo.colors).toHaveLength(0);
  });

  it('expand margins grow the drawn rect outward before any other geometry is built', () => {
    // StyleBoxFlat::get_draw_rect / draw(): style_rect =
    // p_rect.grow_individual(expand_margin[LEFT/TOP/RIGHT/BOTTOM]): a positive
    // margin moves the position outward (core/math/rect2.h) and grows the size.
    const geo = styleBoxFlatGeometry(box({ expandMargin: { left: 2, top: 3, right: 4, bottom: 5 } }), {
      x: 10,
      y: 10,
      w: 100,
      h: 50,
    });
    const xs = [...geo.positions].filter((_, idx) => idx % 3 === 0);
    const ys = [...geo.positions].filter((_, idx) => idx % 3 === 1);
    expect(Math.min(...xs)).toBeCloseTo(10 - 2);
    expect(Math.max(...xs)).toBeCloseTo(10 + 100 + 4);
    expect(Math.min(...ys)).toBeCloseTo(10 - 3);
    expect(Math.max(...ys)).toBeCloseTo(10 + 50 + 5);
  });
});

describe('styleBoxFlatGeometry anti-aliasing (style_box_flat.cpp:468-471,511-630)', () => {
  it('a sharp rect (no rounded corner) ignores anti_aliased entirely — aa_on requires rounded_corners', () => {
    // draw(): `aa_on = (rounded_corners || !skew.is_zero_approx()) && anti_aliased`.
    // With zero skew and zero radii, aa_on is false whatever anti_aliased says,
    // so the geometry is the 8 vertices of the sharp rect above.
    const off = styleBoxFlatGeometry(box({ antiAliased: false }), { x: 0, y: 0, w: 100, h: 50 });
    const on = styleBoxFlatGeometry(box({ antiAliased: true, aaSize: 1 }), { x: 0, y: 0, w: 100, h: 50 });
    expect(on.positions).toEqual(off.positions);
    expect(on.colors).toEqual(off.colors);
    expect(on.indices).toEqual(off.indices);
    expect(off.positions).toHaveLength(8 * 3);
  });

  it('sweeps each corner arc in the authored corner_detail steps, not a fixed 8', () => {
    // style_box_flat.cpp:356: ring_vert_count = (adapted_corner_detail + 1) *
    // (draw_border ? 8 : 4), and :316 adapts to 1 only when every radius is 0.
    // A filled ring is (detail + 1) * 4, so 5 draws 24 where 8 draws 36.
    const rounded = { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 };
    const five = styleBoxFlatGeometry(box({ cornerRadius: rounded, cornerDetail: 5 }), { x: 0, y: 0, w: 100, h: 50 });
    const eight = styleBoxFlatGeometry(box({ cornerRadius: rounded, cornerDetail: 8 }), { x: 0, y: 0, w: 100, h: 50 });
    expect(five.positions).toHaveLength((5 + 1) * 4 * 3);
    expect(eight.positions).toHaveLength((8 + 1) * 4 * 3);
  });

  it('still collapses every corner to a single step when no radius is authored, whatever corner_detail says', () => {
    // :316's adaptation reads the radii, not the detail: a sharp rect stays 8
    // vertices even at corner_detail 20.
    const sharp = styleBoxFlatGeometry(box({ cornerDetail: 20 }), { x: 0, y: 0, w: 100, h: 50 });
    expect(sharp.positions).toHaveLength(8 * 3);
  });

  it('rounded corners, no border: anti_aliased adds a 108-vertex AA fill ring (108 vs the 36-vertex non-AA fill)', () => {
    // No border, so blend_on is false and the aa_on block draws the filled infill
    // at infill_rect_aa_colored ((8+1)*4 = 36) and a doubled AA ring from
    // infill_rect_aa_transparent (alpha 0) to infill_rect_aa_colored ((8+1)*4*2 = 72).
    // 36 + 72 = 108, against 36 without AA.
    const params = box({ cornerRadius: { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 } });
    const rect = { x: 0, y: 0, w: 100, h: 50 };

    const aaOff = styleBoxFlatGeometry(params, rect);
    expect(aaOff.positions).toHaveLength(36 * 3);

    const aaOn = styleBoxFlatGeometry({ ...params, antiAliased: true, aaSize: 1 }, rect);
    expect(aaOn.positions).toHaveLength(108 * 3);
    expect(aaOn.colors).toHaveLength(108 * 4);

    // Vertices [0, 36) are the colored (non-AA-yet) filled centre, alpha 1.
    for (let i = 0; i < 36; i++) {
      expect(aaOn.colors.slice(i * 4, i * 4 + 4)).toEqual([RED.r, RED.g, RED.b, RED.a]);
    }
    // Vertices [36, 108) are the AA ring: even offsets are the inner (opaque
    // bg_color) boundary, odd offsets the outer (alpha 0, same rgb) one, since
    // draw_rounded_rectangle writes inner then outer per step.
    for (let i = 0; i < 72; i += 2) {
      expect(aaOn.colors.slice((36 + i) * 4, (36 + i) * 4 + 4)).toEqual([RED.r, RED.g, RED.b, RED.a]);
      expect(aaOn.colors.slice((36 + i + 1) * 4, (36 + i + 1) * 4 + 4)).toEqual([RED.r, RED.g, RED.b, 0]);
    }
  });

  it('rounded corners + uniform border: anti_aliased adds a 324-vertex geometry (vs. 108 non-AA), with an outer feather ring extending aa_size/2 PAST the style rect at alpha 0', () => {
    // Border 5, radius 10, no blend. Without AA: border ring 72 + infill 36 = 108.
    // With AA (style_box_flat.cpp:511-517): four rings of 72 (a zero-width fill
    // AA ring, the border ring and its inner and outer AA rings) + the centre
    // 36 = 324.
    const rect = { x: 0, y: 0, w: 100, h: 50 };
    const params = box({
      borderWidth: { left: 5, top: 5, right: 5, bottom: 5 },
      cornerRadius: { topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10 },
    });

    const aaOff = styleBoxFlatGeometry(params, rect);
    expect(aaOff.positions).toHaveLength(108 * 3);

    const aaOn = styleBoxFlatGeometry({ ...params, antiAliased: true, aaSize: 1 }, rect);
    expect(aaOn.positions).toHaveLength(324 * 3);
    expect(aaOn.colors).toHaveLength(324 * 4);

    // The last 72 vertices are the border's outer feather ring
    // (style_box_flat.cpp:626-628): even offsets are opaque border_color, odd
    // offsets alpha-0 border_color aa_size/2 = 0.5px outside the style rect.
    const ringStart = 324 - 72;
    const xs: number[] = [];
    for (let i = 0; i < 72; i += 2) {
      const innerIdx = ringStart + i;
      const outerIdx = ringStart + i + 1;
      expect(aaOn.colors.slice(innerIdx * 4, innerIdx * 4 + 4)).toEqual([GREEN.r, GREEN.g, GREEN.b, 1]);
      expect(aaOn.colors.slice(outerIdx * 4, outerIdx * 4 + 4)).toEqual([GREEN.r, GREEN.g, GREEN.b, 0]);
      xs.push(aaOn.positions[outerIdx * 3]!);
    }
    // The alpha-0 boundary's leftmost point sits half the AA size beyond the
    // original style rect's left edge (x = 0).
    expect(Math.min(...xs)).toBeCloseTo(-0.5);
  });
});

/**
 * `skew` and the drop shadow: the two `StyleBoxFlat::draw` stages that are
 * whole passes rather than parameters of the ring tested above.
 */
describe('styleBoxFlatGeometry — skew (style_box_flat.cpp:352,377-378,386-387)', () => {
  const RECT = { x: 0, y: 0, w: 100, h: 50 };

  it('shears every vertex about the style rect CENTRE, leaving the centre itself fixed', () => {
    // `x_skew = -skew.x * (y - style_rect_center.y)`, `y_skew = -skew.y * (x -
    // style_rect_center.x)`. The rect is 100x50 at the origin, so the centre is
    // (50, 25) and a corner at (0, 0) moves by (-skew.x * -25, -skew.y * -50)
    // = (+25 * skew.x, +50 * skew.y).
    const plain = styleBoxFlatGeometry(box({}), RECT);
    const skewed = styleBoxFlatGeometry(box({ skew: { x: 0.4, y: 0 } }), RECT);
    expect(skewed.positions).toHaveLength(plain.positions.length);

    for (let i = 0; i < plain.positions.length; i += 3) {
      const x = plain.positions[i]!;
      const y = plain.positions[i + 1]!;
      expect(skewed.positions[i]).toBeCloseTo(x + -0.4 * (y - 25), 5);
      // skew.y is 0 here, so no vertex moves vertically.
      expect(skewed.positions[i + 1]).toBeCloseTo(y, 5);
    }
  });

  it('shears on the other axis independently', () => {
    const plain = styleBoxFlatGeometry(box({}), RECT);
    const skewed = styleBoxFlatGeometry(box({ skew: { x: 0, y: 0.25 } }), RECT);
    for (let i = 0; i < plain.positions.length; i += 3) {
      const x = plain.positions[i]!;
      expect(skewed.positions[i]).toBeCloseTo(x, 5);
      expect(skewed.positions[i + 1]).toBeCloseTo(plain.positions[i + 1]! + -0.25 * (x - 50), 5);
    }
  });

  it('turns anti-aliasing ON for a SHARP-cornered box, which a radius alone would not', () => {
    // `:471`: `aa_on = (rounded_corners || !skew.is_zero_approx()) &&
    // anti_aliased`. A skewed edge is diagonal and needs the feather: the sharp
    // non-skewed case is 8 vertices, and the AA rings multiply that.
    const sharp = styleBoxFlatGeometry(box({ antiAliased: true }), RECT);
    const skewed = styleBoxFlatGeometry(box({ antiAliased: true, skew: { x: 0.4, y: 0 } }), RECT);
    expect(sharp.positions).toHaveLength(8 * 3);
    expect(skewed.positions.length).toBeGreaterThan(sharp.positions.length);
  });

  it('leaves the geometry untouched when anti_aliased is off, however skewed', () => {
    const off = styleBoxFlatGeometry(box({ antiAliased: false, skew: { x: 0.4, y: 0 } }), RECT);
    expect(off.positions).toHaveLength(8 * 3);
  });
});

describe('styleBoxFlatGeometry — drop shadow (style_box_flat.cpp:524-540)', () => {
  const RECT = { x: 0, y: 0, w: 100, h: 50 };

  it('draws nothing extra while shadow_size is 0', () => {
    // `draw_shadow = (shadow_size > 0)` (`:458`): a shadow_color alone paints nothing.
    const none = styleBoxFlatGeometry(box({ shadowColor: { r: 1, g: 0, b: 0, a: 1 } }), RECT);
    expect(none.positions).toHaveLength(8 * 3);
  });

  it('draws the shadow even when the box has no border and no centre', () => {
    // `:459` returns early only when all three are absent, so a shadow-only
    // stylebox still paints.
    const shadowOnly = styleBoxFlatGeometry(box({ drawCenter: false, shadowSize: 6 }), RECT);
    expect(shadowOnly.positions.length).toBeGreaterThan(0);
  });

  it('grows the shadow ring by shadow_size and displaces it by shadow_offset', () => {
    // `shadow_rect = style_rect.grow(shadow_size)` then `.position +=
    // shadow_offset` (`:529-530`). The furthest-left vertex is therefore the
    // style rect's own left, minus the growth, plus the offset.
    const shadowed = styleBoxFlatGeometry(
      box({ shadowSize: 6, shadowOffset: { x: 4, y: 3 } }),
      RECT
    );
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < shadowed.positions.length; i += 3) {
      xs.push(shadowed.positions[i]!);
      ys.push(shadowed.positions[i + 1]!);
    }
    expect(Math.min(...xs)).toBeCloseTo(0 - 6 + 4, 5);
    expect(Math.min(...ys)).toBeCloseTo(0 - 6 + 3, 5);
    expect(Math.max(...xs)).toBeCloseTo(100 + 6 + 4, 5);
    expect(Math.max(...ys)).toBeCloseTo(50 + 6 + 3, 5);
  });

  it('fades the shadow ring from shadow_color to the SAME colour at alpha 0', () => {
    // `shadow_color_transparent = Color(r, g, b, 0)` (`:532`): the rgb is
    // carried, so the fade is in alpha only.
    const shadowed = styleBoxFlatGeometry(
      box({ shadowSize: 6, shadowColor: { r: 0.2, g: 0.4, b: 0.6, a: 0.8 } }),
      RECT
    );
    // The shadow is the first stage drawn, so its ring owns vertex 0 (inner,
    // opaque) and vertex 1 (outer, transparent).
    expect(shadowed.colors.slice(0, 4)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(shadowed.colors.slice(4, 8)).toEqual([0.2, 0.4, 0.6, 0]);
  });

  it('draws the shadow BEFORE the box, so the box paints over it', () => {
    // Draw order is buffer order here: `:525`'s shadow block precedes the
    // border and infill blocks. A shadow appended last would cover the fill.
    const shadowed = styleBoxFlatGeometry(
      box({ shadowSize: 6, shadowColor: { r: 1, g: 0, b: 0, a: 1 }, bgColor: { r: 0, g: 1, b: 0, a: 1 } }),
      RECT
    );
    expect(shadowed.colors.slice(0, 3)).toEqual([1, 0, 0]);
  });

  it('fills the shadow interior only when draw_center is on', () => {
    // `:535`'s `if (draw_center)`: a hollow box casts a hollow shadow, so the
    // fill shows through both.
    const filled = styleBoxFlatGeometry(box({ shadowSize: 6 }), RECT);
    const hollow = styleBoxFlatGeometry(box({ shadowSize: 6, drawCenter: false }), RECT);
    expect(filled.positions.length).toBeGreaterThan(hollow.positions.length);
  });
});

/**
 * The ring triangulation's shape, sampled rather than counted. The border ring's
 * `(i, i+2, i+1)` indices (style_box_flat.cpp:403-408) give each quad two
 * triangles of opposite winding, so a painter that splits the draw by facing
 * leaves a wedge per step. The whole list tiles the band, and neither winding alone does.
 */
describe('styleBoxFlatGeometry — ring triangulation coverage', () => {
  /** The bordered, rounded, hollow, antialiased box the ring artifact needs. */
  const RING_BOX = box({
    borderWidth: { left: 12, top: 12, right: 12, bottom: 12 },
    cornerRadius: { topLeft: 24, topRight: 24, bottomRight: 24, bottomLeft: 24 },
    drawCenter: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
  });
  const RING_RECT = { x: 0, y: 0, w: 480, h: 260 };

  interface Tri {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    cx: number;
    cy: number;
    alpha: number;
    /** Twice the signed area: its sign is the screen-space winding. */
    area2: number;
  }

  function triangles(geo: ReturnType<typeof styleBoxFlatGeometry>): Tri[] {
    const out: Tri[] = [];
    for (let i = 0; i < geo.indices.length; i += 3) {
      const [i0, i1, i2] = [geo.indices[i]!, geo.indices[i + 1]!, geo.indices[i + 2]!];
      const [ax, ay] = [geo.positions[i0 * 3]!, geo.positions[i0 * 3 + 1]!];
      const [bx, by] = [geo.positions[i1 * 3]!, geo.positions[i1 * 3 + 1]!];
      const [cx, cy] = [geo.positions[i2 * 3]!, geo.positions[i2 * 3 + 1]!];
      // Every vertex of one ring carries one colour, and the only ring that
      // reaches the samples below is the opaque border ring, so a single
      // per-triangle alpha is enough to express "did an opaque triangle
      // cover this point".
      const alpha = Math.min(geo.colors[i0 * 4 + 3]!, geo.colors[i1 * 4 + 3]!, geo.colors[i2 * 4 + 3]!);
      out.push({ ax, ay, bx, by, cx, cy, alpha, area2: (bx - ax) * (cy - ay) - (cx - ax) * (by - ay) });
    }
    return out;
  }

  /**
   * Whether an opaque triangle covers a point. A zero-area triangle covers
   * nothing, or a degenerate one would contain every point on its line and
   * hide the gap this looks for.
   */
  function covers(t: Tri, px: number, py: number): boolean {
    if (Math.abs(t.area2) < 1e-9 || t.alpha < 1) return false;
    const d = (t.by - t.cy) * (t.ax - t.cx) + (t.cx - t.bx) * (t.ay - t.cy);
    const l1 = ((t.by - t.cy) * (px - t.cx) + (t.cx - t.bx) * (py - t.cy)) / d;
    const l2 = ((t.cy - t.ay) * (px - t.cx) + (t.ax - t.cx) * (py - t.cy)) / d;
    return l1 >= 0 && l2 >= 0 && l1 + l2 <= 1;
  }

  /**
   * Points strictly inside the bottom-left corner's border band, between
   * `inner_rect_aa_colored` (radius 24 - 10.5 = 13.5) and `outer_rect_aa_colored`
   * (radius 24 + 0.5 = 24.5), centred on (25, 235). Both are chords between 8
   * steps, so the samples stay a margin inside either arc.
   */
  function arcSamples(): [number, number][] {
    const pts: [number, number][] = [];
    for (let step = 0; step <= 64; step++) {
      const angle = Math.PI / 2 + (step / 64) * (Math.PI / 2);
      for (let r = 14.5; r <= 23.5; r += 0.5) {
        pts.push([25 + r * Math.cos(angle), 235 + r * Math.sin(angle)]);
      }
    }
    return pts;
  }

  it('the whole triangle list covers every point of the corner band', () => {
    const tris = triangles(styleBoxFlatGeometry(RING_BOX, RING_RECT));
    const uncovered = arcSamples().filter(([x, y]) => !tris.some((t) => covers(t, x, y)));
    expect(uncovered).toEqual([]);
  });

  it('each winding alone leaves wedges, so the ring must never be drawn facing-split', () => {
    const tris = triangles(styleBoxFlatGeometry(RING_BOX, RING_RECT));
    const samples = arcSamples();
    const front = tris.filter((t) => t.area2 > 0);
    const back = tris.filter((t) => t.area2 < 0);

    // Both windings are present: the alternation is the source's index
    // pattern, not an accident of this box's numbers.
    expect(front.length).toBeGreaterThan(0);
    expect(back.length).toBeGreaterThan(0);

    // ...and one facing's triangles cannot tile the band by themselves.
    expect(samples.filter(([x, y]) => !front.some((t) => covers(t, x, y))).length).toBeGreaterThan(0);
    expect(samples.filter(([x, y]) => !back.some((t) => covers(t, x, y))).length).toBeGreaterThan(0);
  });
});
