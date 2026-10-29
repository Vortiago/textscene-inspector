/**
 * `Transform2D` construction, product, affine inverse and scale against the engine's own formulas
 * (`transform_2d.cpp:107-113`, `:198-218`, `:48-66`, `:115-118`), and the guard that keeps them the
 * only spelling, so a linter verdict and a drawn placement read the same transform.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  TRANSFORM2D_IDENTITY,
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DFromParts,
  transform2DGetScale,
  transform2DHasZeroSkew,
  transform2DIsConformal,
  transform2DXform,
  type Transform2DColumns,
} from './transform2d.js';
import { storedReal, storedReal as f, storedTransform2D } from './real.js';
import { allSourceFiles, srcLabel } from '../../linter/testing/ruleNameScrape.js';

/** A point through `t`: `(a*x + c*y + tx, b*x + d*y + ty)`. */
function xform(t: Transform2DColumns, x: number, y: number): [number, number] {
  return [t.a * x + t.c * y + t.tx, t.b * x + t.d * y + t.ty];
}

/** The constructor as `transform_2d.cpp:107-113` writes it in `real_t`, `-Math::sin` and all. */
function godotConstructor(
  rot: number,
  scale: { x: number; y: number },
  skew: number,
  pos: { x: number; y: number }
): number[] {
  return [
    f(f(Math.cos(f(rot))) * f(scale.x)),
    f(f(Math.sin(f(rot))) * f(scale.x)),
    -f(f(Math.sin(f(f(rot) + f(skew)))) * f(scale.y)),
    f(f(Math.cos(f(f(rot) + f(skew)))) * f(scale.y)),
    f(pos.x),
    f(pos.y),
  ];
}

const components = (t: Transform2DColumns): number[] => [t.a, t.b, t.c, t.d, t.tx, t.ty];

const ROTATIONS = [0, -0, 0.5, -1.2, Math.PI / 2, Math.PI, -Math.PI, 3.7];
const SKEWS = [0, 0.25, -0.5, Math.PI / 3];
const SCALES = [
  { x: 1, y: 1 },
  { x: 2, y: -3 },
  { x: -0.5, y: 0.25 },
  { x: 0, y: 1 },
];

describe('transform2DFromParts', () => {
  it('builds the identity from the Node2D defaults, every zero a +0', () => {
    const t = transform2DFromParts(0, { x: 1, y: 1 }, 0, { x: 0, y: 0 });
    // `toEqual` tells -0 from +0, so this pins the `0 - v` spelling of `c`.
    expect(t).toEqual(TRANSFORM2D_IDENTITY);
  });

  it('places the rotated, scaled axes and the origin', () => {
    const t = transform2DFromParts(Math.PI / 2, { x: 2, y: 3 }, 0, { x: 10, y: 20 });
    const [x, y] = xform(t, 1, 0);
    // +Y down: a quarter turn carries the x axis onto +Y.
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(22, 5);
    const [x2, y2] = xform(t, 0, 1);
    expect(x2).toBeCloseTo(7, 5);
    expect(y2).toBeCloseTo(20, 5);
  });

  it('tilts only the y axis by the skew', () => {
    const skew = Math.PI / 6;
    const t = transform2DFromParts(0, { x: 1, y: 1 }, skew, { x: 0, y: 0 });
    expect([t.a, t.b]).toEqual([1, 0]);
    expect(t.c).toBeCloseTo(-Math.sin(skew), 6);
    expect(t.d).toBeCloseTo(Math.cos(skew), 6);
  });

  it('equals the engine constructor component for component, wherever it is evaluated', () => {
    // `===`: the one difference from `-Math::sin` is the sign of a zero `c`.
    for (const rot of ROTATIONS) {
      for (const skew of SKEWS) {
        for (const scale of SCALES) {
          const built = components(transform2DFromParts(rot, scale, skew, { x: 3, y: -4 }));
          const engine = godotConstructor(rot, scale, skew, { x: 3, y: -4 });
          built.forEach((value, i) => {
            expect({ rot, skew, scale, i, same: value === engine[i] }).toEqual({
              rot,
              skew,
              scale,
              i,
              same: true,
            });
          });
        }
      }
    }
  });
});

describe('multiplyTransform2D', () => {
  const parent = transform2DFromParts(0.7, { x: 2, y: 0.5 }, 0.2, { x: 5, y: -6 });
  const local = transform2DFromParts(-1.1, { x: -1, y: 3 }, -0.4, { x: 8, y: 9 });

  it('maps a point through local, then parent', () => {
    const product = multiplyTransform2D(parent, local);
    const [lx, ly] = xform(local, 1.5, -2.5);
    const [ex, ey] = xform(parent, lx, ly);
    const [px, py] = xform(product, 1.5, -2.5);
    expect(px).toBeCloseTo(ex, 4);
    expect(py).toBeCloseTo(ey, 4);
  });

  it('leaves a transform unchanged on either side of the identity', () => {
    expect(multiplyTransform2D(TRANSFORM2D_IDENTITY, local)).toEqual(local);
    expect(multiplyTransform2D(local, TRANSFORM2D_IDENTITY)).toEqual(local);
  });

  it("keeps operator*'s order of operations, so a port gets the engine's bits", () => {
    // `columns[i] = basis_xform(columns[i])`, then `xform` adds the origin
    // (`transform_2d.cpp:198-212`): each sum runs left to right, as here.
    const tdotx = (t: Transform2DColumns, x: number, y: number) => f(f(t.a * x) + f(t.c * y));
    const tdoty = (t: Transform2DColumns, x: number, y: number) => f(f(t.b * x) + f(t.d * y));
    const engine = [
      tdotx(parent, local.a, local.b),
      tdoty(parent, local.a, local.b),
      tdotx(parent, local.c, local.d),
      tdoty(parent, local.c, local.d),
      f(tdotx(parent, local.tx, local.ty) + parent.tx),
      f(tdoty(parent, local.tx, local.ty) + parent.ty),
    ];
    expect(components(multiplyTransform2D(parent, local))).toEqual(engine);
  });

  it('does not commute, so the operand order is part of the contract', () => {
    const forward = components(multiplyTransform2D(parent, local));
    const reverse = components(multiplyTransform2D(local, parent));
    expect(forward).not.toEqual(reverse);
  });
});

describe('affineInverseTransform2D', () => {
  const skewed = transform2DFromParts(0.7, { x: 2, y: -0.5 }, 0.3, { x: 5, y: -6 });

  it('undoes the transform on either side, skew and reflection included', () => {
    for (const product of [
      multiplyTransform2D(affineInverseTransform2D(skewed), skewed),
      multiplyTransform2D(skewed, affineInverseTransform2D(skewed)),
    ]) {
      components(product).forEach((value, i) => {
        expect(value).toBeCloseTo(components(TRANSFORM2D_IDENTITY)[i]!, 5);
      });
    }
  });

  it('maps a transformed point back to where it started', () => {
    const [x, y] = xform(skewed, 1.5, -2.5);
    const [bx, by] = xform(affineInverseTransform2D(skewed), x, y);
    expect(bx).toBeCloseTo(1.5, 5);
    expect(by).toBeCloseTo(-2.5, 5);
  });

  it('answers the identity for a transform scaled to zero, which has no inverse', () => {
    const collapsed = transform2DFromParts(0.4, { x: 0, y: 1 }, 0, { x: 3, y: 4 });
    expect(affineInverseTransform2D(collapsed)).toBe(TRANSFORM2D_IDENTITY);
  });

  it('answers the identity, never NaN, for a non-finite determinant', () => {
    const blown = transform2DFromParts(0, { x: Infinity, y: 1 }, 0, { x: 0, y: 0 });
    const poisoned = transform2DFromParts(0, { x: NaN, y: 1 }, 0, { x: 0, y: 0 });
    expect(affineInverseTransform2D(blown)).toBe(TRANSFORM2D_IDENTITY);
    expect(affineInverseTransform2D(poisoned)).toBe(TRANSFORM2D_IDENTITY);
  });
});

describe('transform2DGetScale', () => {
  it('signs the y column by the determinant', () => {
    expect(transform2DGetScale({ a: 2, b: 0, c: 0, d: 3, tx: 0, ty: 0 })).toEqual({ x: 2, y: 3 });
    // A flip puts the determinant negative, and the y length follows it.
    expect(transform2DGetScale({ a: 2, b: 0, c: 0, d: -3, tx: 0, ty: 0 })).toEqual({ x: 2, y: -3 });
  });

  it('reads a degenerate transform as zero scale on y', () => {
    // `SIGN(0)` is 0 (typedefs.h:123-126), so a zero determinant zeroes the
    // signed half rather than leaving it unsigned.
    expect(transform2DGetScale({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 })).toEqual({ x: 0, y: 0 });
    expect(transform2DGetScale({ a: 1, b: 0, c: 2, d: 0, tx: 0, ty: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('reads a NaN determinant the way SIGN does, as zero', () => {
    // `SIGN` is `m_v > 0 ? +1 : (m_v < 0 ? -1 : 0)` (typedefs.h:123-126), so NaN
    // falls through to 0, where `Math.sign` returns NaN and poisons a finite y
    // column. `nan` is a float literal Godot writes and reloads, so
    // `scale = Vector2(nan, 1)` lands here.
    const nanDeterminant = { a: NaN, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    expect(transform2DGetScale(nanDeterminant).y).toBe(0);
  });
});

describe('transform2DIsConformal', () => {
  it('accepts a uniform scale under rotation, reflected or not', () => {
    expect(transform2DIsConformal(transform2DFromParts(0.7, { x: 2, y: 2 }, 0, { x: 5, y: 6 }))).toBe(true);
    expect(transform2DIsConformal(transform2DFromParts(0.7, { x: 2, y: -2 }, 0, { x: 0, y: 0 }))).toBe(true);
  });

  it('refuses a non-uniform scale and a skew', () => {
    expect(transform2DIsConformal(transform2DFromParts(0, { x: 2, y: 3 }, 0, { x: 0, y: 0 }))).toBe(false);
    expect(transform2DIsConformal(transform2DFromParts(0, { x: 1, y: 1 }, 0.3, { x: 0, y: 0 }))).toBe(false);
  });
});

describe('transform2DHasZeroSkew', () => {
  it('reads orthogonal axes as unskewed through cos and sin residue', () => {
    expect(
      transform2DHasZeroSkew(transform2DFromParts(Math.PI / 3, { x: 2, y: -5 }, 0, { x: 0, y: 0 }))
    ).toBe(true);
  });

  it('reads a few degrees of skew as skewed', () => {
    expect(transform2DHasZeroSkew(transform2DFromParts(0, { x: 1, y: 1 }, 0.05, { x: 0, y: 0 }))).toBe(false);
  });

  it('reads a zero axis and parallel axes as unskewed, as get_skew() does', () => {
    expect(transform2DHasZeroSkew({ a: 0, b: 0, c: 0, d: 1, tx: 0, ty: 0 })).toBe(true);
    expect(transform2DHasZeroSkew({ a: 1, b: 0, c: 2, d: 0, tx: 0, ty: 0 })).toBe(true);
  });
});

// The expected numbers are Godot 4.6.3's own float `Transform2D`, from
// /mnt/project-files/cpuparticles2d-995/transform-oracle.gd.
describe('the Transform2D of Godot 4.6.3 in real_t float', () => {
  const parent = storedTransform2D({ a: 0.7, b: 0.3, c: -1.1, d: 0.9, tx: 13.3, ty: -7.1 });
  const local = storedTransform2D({ a: 1.7, b: -0.6, c: 0.45, d: 2.3, tx: -3.9, ty: 5.7 });

  it('multiplies two transforms as Godot rounds the product', () => {
    expect(multiplyTransform2D(parent, local)).toEqual(
      storedTransform2D({
        a: 1.850000143051,
        b: -0.02999997139,
        c: -2.214999914169,
        d: 2.204999923706,
        tx: 4.300000190735,
        ty: -3.140000343323,
      })
    );
  });

  it('maps a point through the basis and the origin', () => {
    const point = transform2DXform(parent, { x: storedReal(2.3), y: storedReal(-4.1) });
    expect(point).toEqual({ x: storedReal(19.420000076294), y: storedReal(-10.099999427795) });
  });

  it('inverts an affine transform as Godot rounds the inverse', () => {
    expect(affineInverseTransform2D(parent)).toEqual(
      storedTransform2D({
        a: 0.937499940395,
        b: -0.3125,
        c: 1.14583337307,
        d: 0.72916662693,
        tx: -4.333332061768,
        ty: 9.333333015442,
      })
    );
  });

  it('answers the identity for a singular transform (edge case)', () => {
    expect(affineInverseTransform2D({ a: 0, b: 0, c: 0, d: 0, tx: 5, ty: 5 })).toBe(TRANSFORM2D_IDENTITY);
  });
});

describe('the one spelling of the Transform2D construction, product and inverse', () => {
  /** `sin(rotation + skew)`, the constructor's y-axis term, in any variable naming. */
  const CONSTRUCTION = /\b(?:sin|cos)\(\s*(?:[\w.]*\s*\+\s*)?[\w.]*skew\w*\s*\)/;
  /** `operator*`'s first row over the `{ a, b, c, d }` layout. */
  const PRODUCT = /\b(\w+)\.a \* (\w+)\.a\)? \+ (?:f\()?\1\.c \* \2\.b\b/;
  /** The product spelled column by column, or over the `{ ax, ay, bx, by, ox, oy }` layout. */
  const COLUMN_PRODUCT =
    /\b(\w+)\.ax \* (\w+)\.ax \+ \1\.bx \* \2\.ay\b|basisXform\(\s*\w+,\s*\{\s*x:\s*\w+\.ax?,\s*y:\s*\w+\.(?:ay|b)\s*\}/;
  /** The affine inverse's reciprocal of the determinant, under any variable naming. */
  const INVERSE = /=\s*(?:f\(\s*)?1\s*\/\s*\(?\s*(?:det|determinant)\b/;
  /** A second field layout for the same six numbers: `ax`, `bx` and `ox` declared together. */
  const OTHER_LAYOUT = /\bax\s*[:?][\s\S]{0,120}?\bbx\s*[:?][\s\S]{0,120}?\box\s*[:?]/;

  const sources = allSourceFiles().map((file) => ({
    rel: srcLabel(file),
    text: readFileSync(file, 'utf8'),
  }));

  it('detects every shape before trusting their absence', () => {
    expect(CONSTRUCTION.test('c: -Math.sin(rotation + skew) * scale.y')).toBe(true);
    expect(CONSTRUCTION.test('const sS = Math.sin(t.rotation + skew);')).toBe(true);
    expect(PRODUCT.test('a: m1.a * m2.a + m1.c * m2.b,')).toBe(true);
    expect(COLUMN_PRODUCT.test('const col0 = basisXform(a, { x: b.ax, y: b.ay });')).toBe(true);
    expect(COLUMN_PRODUCT.test('ax: p.ax * c.ax + p.bx * c.ay,')).toBe(true);
    expect(OTHER_LAYOUT.test('{ ax: 1, ay: 0, bx: 0, by: 1, ox: 0, oy: 0 }')).toBe(true);
    expect(
      OTHER_LAYOUT.test(
        'interface T {\n  ax: number;\n  ay: number;\n  bx: number;\n  by: number;\n  ox: number;\n}'
      )
    ).toBe(true);
    expect(INVERSE.test('const inv = 1 / det;')).toBe(true);
    expect(INVERSE.test('const idet = 1/(determinant);')).toBe(true);
    expect(PRODUCT.test('a: f(f(parent.a * local.a) + f(parent.c * local.b)),')).toBe(true);
    expect(INVERSE.test('const idet = f(1 / det);')).toBe(true);
    expect(CONSTRUCTION.test('Math.sin(skewed)')).toBe(true);
    expect(CONSTRUCTION.test('Math.sin(rotation)')).toBe(false);
    expect(OTHER_LAYOUT.test('{ ax: 1, ay: 0 }')).toBe(false);
  });

  it('builds a Node2D transform only here', () => {
    const builders = sources.filter(({ text }) => CONSTRUCTION.test(text)).map(({ rel }) => rel);
    expect(builders).toEqual(['godot/math/transform2d.ts']);
  });

  it('composes two transforms only here', () => {
    const composers = sources
      .filter(({ text }) => PRODUCT.test(text) || COLUMN_PRODUCT.test(text))
      .map(({ rel }) => rel);
    expect(composers).toEqual(['godot/math/transform2d.ts']);
  });

  it('inverts a transform only here', () => {
    // `basis.ts` holds `Basis::invert`, the 3D inverse of a different type.
    const inverters = sources
      .filter(({ rel, text }) => rel !== 'godot/math/basis.ts' && INVERSE.test(text))
      .map(({ rel }) => rel);
    expect(inverters).toEqual(['godot/math/transform2d.ts']);
  });

  it('declares no second field layout for a Transform2D', () => {
    const layouts = sources.filter(({ text }) => OTHER_LAYOUT.test(text)).map(({ rel }) => rel);
    expect(layouts).toEqual([]);
  });
});
