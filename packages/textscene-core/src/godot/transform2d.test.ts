/**
 * `Transform2D` construction and product against the engine's own formulas
 * (`transform_2d.cpp:107-113`, `:198-218`), and the guard that keeps them the only
 * spelling, so a linter verdict and a drawn placement read the same transform.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  transform2DFromParts,
  type Transform2DColumns,
} from './transform2d.js';
import { allSourceFiles, srcRoot } from '../linter/testing/ruleNameScrape.js';

/** A point through `t`: `(a*x + c*y + tx, b*x + d*y + ty)`. */
function xform(t: Transform2DColumns, x: number, y: number): [number, number] {
  return [t.a * x + t.c * y + t.tx, t.b * x + t.d * y + t.ty];
}

/** The constructor as `transform_2d.cpp:107-113` writes it, `-Math::sin` and all. */
function godotConstructor(
  rot: number,
  scale: { x: number; y: number },
  skew: number,
  pos: { x: number; y: number }
): number[] {
  return [
    Math.cos(rot) * scale.x,
    Math.sin(rot) * scale.x,
    -Math.sin(rot + skew) * scale.y,
    Math.cos(rot + skew) * scale.y,
    pos.x,
    pos.y,
  ];
}

const components = (t: Transform2DColumns): number[] => [t.a, t.b, t.c, t.d, t.tx, t.ty];

const ROTATIONS = [0, -0, 0.5, -1.2, Math.PI / 2, Math.PI, -Math.PI, 3.7];
const SKEWS = [0, 0.25, -0.5, Math.PI / 3];
const SCALES = [{ x: 1, y: 1 }, { x: 2, y: -3 }, { x: -0.5, y: 0.25 }, { x: 0, y: 1 }];

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
    expect(x).toBeCloseTo(10, 12);
    expect(y).toBeCloseTo(22, 12);
    const [x2, y2] = xform(t, 0, 1);
    expect(x2).toBeCloseTo(7, 12);
    expect(y2).toBeCloseTo(20, 12);
  });

  it('tilts only the y axis by the skew', () => {
    const skew = Math.PI / 6;
    const t = transform2DFromParts(0, { x: 1, y: 1 }, skew, { x: 0, y: 0 });
    expect([t.a, t.b]).toEqual([1, 0]);
    expect(t.c).toBeCloseTo(-Math.sin(skew), 15);
    expect(t.d).toBeCloseTo(Math.cos(skew), 15);
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
              rot, skew, scale, i, same: true,
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
    expect(px).toBeCloseTo(ex, 12);
    expect(py).toBeCloseTo(ey, 12);
  });

  it('leaves a transform unchanged on either side of the identity', () => {
    expect(multiplyTransform2D(TRANSFORM2D_IDENTITY, local)).toEqual(local);
    expect(multiplyTransform2D(local, TRANSFORM2D_IDENTITY)).toEqual(local);
  });

  it("keeps operator*'s order of operations, so a port gets the engine's bits", () => {
    // `columns[i] = basis_xform(columns[i])`, then `xform` adds the origin
    // (`transform_2d.cpp:198-212`): each sum runs left to right, as here.
    const tdotx = (t: Transform2DColumns, x: number, y: number) => t.a * x + t.c * y;
    const tdoty = (t: Transform2DColumns, x: number, y: number) => t.b * x + t.d * y;
    const engine = [
      tdotx(parent, local.a, local.b),
      tdoty(parent, local.a, local.b),
      tdotx(parent, local.c, local.d),
      tdoty(parent, local.c, local.d),
      tdotx(parent, local.tx, local.ty) + parent.tx,
      tdoty(parent, local.tx, local.ty) + parent.ty,
    ];
    expect(components(multiplyTransform2D(parent, local))).toEqual(engine);
  });

  it('does not commute, so the operand order is part of the contract', () => {
    const forward = components(multiplyTransform2D(parent, local));
    const reverse = components(multiplyTransform2D(local, parent));
    expect(forward).not.toEqual(reverse);
  });
});

describe('the one spelling of the Transform2D construction and product', () => {
  /** `sin(rotation + skew)`, the constructor's y-axis term, in any variable naming. */
  const CONSTRUCTION = /\b(?:sin|cos)\(\s*[\w.]*\s*\+\s*[\w.]*skew\b/;
  /** `operator*`'s first row over the `{ a, b, c, d }` layout. */
  const PRODUCT = /\b(\w+)\.a \* (\w+)\.a \+ \1\.c \* \2\.b\b/;
  /** The product spelled column by column, or over the `{ ax, ay, bx, by, ox, oy }` layout. */
  const COLUMN_PRODUCT =
    /\b(\w+)\.ax \* (\w+)\.ax \+ \1\.bx \* \2\.ay\b|basisXform\(\s*\w+,\s*\{\s*x:\s*\w+\.ax?,\s*y:\s*\w+\.(?:ay|b)\s*\}/;
  /** A second field layout for the same six numbers: `ax`, `bx` and `ox` declared together. */
  const OTHER_LAYOUT = /\bax\s*[:?][\s\S]{0,120}?\bbx\s*[:?][\s\S]{0,120}?\box\s*[:?]/;

  const sources = allSourceFiles().map((file) => ({
    rel: relative(srcRoot, file).replaceAll('\\', '/'),
    text: readFileSync(file, 'utf8'),
  }));

  it('detects every shape before trusting their absence', () => {
    expect(CONSTRUCTION.test('c: -Math.sin(rotation + skew) * scale.y')).toBe(true);
    expect(CONSTRUCTION.test('const sS = Math.sin(t.rotation + skew);')).toBe(true);
    expect(PRODUCT.test('a: m1.a * m2.a + m1.c * m2.b,')).toBe(true);
    expect(COLUMN_PRODUCT.test('const col0 = basisXform(a, { x: b.ax, y: b.ay });')).toBe(true);
    expect(COLUMN_PRODUCT.test('ax: p.ax * c.ax + p.bx * c.ay,')).toBe(true);
    expect(OTHER_LAYOUT.test('{ ax: 1, ay: 0, bx: 0, by: 1, ox: 0, oy: 0 }')).toBe(true);
    expect(OTHER_LAYOUT.test('interface T {\n  ax: number;\n  ay: number;\n  bx: number;\n  by: number;\n  ox: number;\n}')).toBe(
      true
    );
    expect(CONSTRUCTION.test('Math.sin(rotation)')).toBe(false);
    expect(OTHER_LAYOUT.test('{ ax: 1, ay: 0 }')).toBe(false);
  });

  it('builds a Node2D transform only here', () => {
    const builders = sources.filter(({ text }) => CONSTRUCTION.test(text)).map(({ rel }) => rel);
    expect(builders).toEqual(['godot/transform2d.ts']);
  });

  it('composes two transforms only here', () => {
    const composers = sources
      .filter(({ text }) => PRODUCT.test(text) || COLUMN_PRODUCT.test(text))
      .map(({ rel }) => rel);
    expect(composers).toEqual(['godot/transform2d.ts']);
  });

  it('declares no second field layout for a Transform2D', () => {
    const layouts = sources.filter(({ text }) => OTHER_LAYOUT.test(text)).map(({ rel }) => rel);
    expect(layouts).toEqual([]);
  });
});
