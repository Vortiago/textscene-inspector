import type { Rect2 } from '../../math/rect2.js';
import { cMax, cMin } from '../../math/math.js';
import { isEqualApproxf } from '../../math/realMath.js';
import { Side } from '../../math/side.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { bool, variant, type Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';
import { componentsOf, vectorOf, type Components } from './vectorPorts.js';

/** The component arithmetic of one rect type: float for `Rect2`, wrapping int32 for `Rect2i`. */
interface RectArithmetic {
  readonly type: 'RECT2' | 'RECT2I';
  readonly point: 'VECTOR2' | 'VECTOR2I';
  readonly scalar: MethodParameter;
  readonly add: (a: number, b: number) => number;
  readonly subtract: (a: number, b: number) => number;
  readonly twice: (a: number) => number;
  readonly absolute: (a: number) => number;
}

const FLOAT_RECT: RectArithmetic = {
  type: 'RECT2',
  point: 'VECTOR2',
  scalar: 'float',
  add: (a, b) => Math.fround(a + b),
  subtract: (a, b) => Math.fround(a - b),
  twice: (a) => Math.fround(a * 2),
  absolute: Math.abs,
};

const INT_RECT: RectArithmetic = {
  type: 'RECT2I',
  point: 'VECTOR2I',
  scalar: 'int32_t',
  add: (a, b) => (a + b) | 0,
  subtract: (a, b) => (a - b) | 0,
  twice: (a) => Math.imul(a, 2),
  // Math::abs of an int32 wraps the lowest value back to itself, as std::abs does on x86-64.
  absolute: (a) => (a > 0 ? a : -a | 0),
};

function rectMethods(arithmetic: RectArithmetic): Readonly<Record<string, MethodPort>> {
  const { type, point, scalar, add, subtract, twice, absolute } = arithmetic;
  const rectOf = (rect: Rect2): Variant => variant(type, rect);
  const endX = (r: Rect2) => add(r.x, r.w);
  const endY = (r: Rect2) => add(r.y, r.h);

  function intersects(r: Rect2, other: Rect2, isBorderIncluded: boolean): boolean {
    if (isBorderIncluded) {
      return !(r.x > endX(other) || endX(r) < other.x || r.y > endY(other) || endY(r) < other.y);
    }
    return !(r.x >= endX(other) || endX(r) <= other.x || r.y >= endY(other) || endY(r) <= other.y);
  }

  function intersection(r: Rect2, other: Rect2): Rect2 {
    if (!intersects(r, other, false)) return { x: 0, y: 0, w: 0, h: 0 };
    const x = cMax(other.x, r.x);
    const y = cMax(other.y, r.y);
    return { x, y, w: subtract(cMin(endX(other), endX(r)), x), h: subtract(cMin(endY(other), endY(r)), y) };
  }

  function merge(r: Rect2, other: Rect2): Rect2 {
    const x = cMin(other.x, r.x);
    const y = cMin(other.y, r.y);
    return { x, y, w: subtract(cMax(endX(other), endX(r)), x), h: subtract(cMax(endY(other), endY(r)), y) };
  }

  function expand(r: Rect2, [px, py]: Components): Rect2 {
    const x = px! < r.x ? px! : r.x;
    const y = py! < r.y ? py! : r.y;
    const right = px! > endX(r) ? px! : endX(r);
    const bottom = py! > endY(r) ? py! : endY(r);
    return { x, y, w: subtract(right, x), h: subtract(bottom, y) };
  }

  const growIndividual = (r: Rect2, left: number, top: number, right: number, bottom: number): Rect2 => ({
    x: subtract(r.x, left),
    y: subtract(r.y, top),
    w: add(r.w, add(left, right)),
    h: add(r.h, add(top, bottom)),
  });

  const growSide = (r: Rect2, side: number, amount: number) =>
    growIndividual(
      r,
      side === Side.LEFT ? amount : 0,
      side === Side.TOP ? amount : 0,
      side === Side.RIGHT ? amount : 0,
      side === Side.BOTTOM ? amount : 0
    );

  const hasPoint = (r: Rect2, [px, py]: Components) =>
    !(px! < r.x || py! < r.y || px! >= endX(r) || py! >= endY(r));

  const encloses = (r: Rect2, other: Rect2) =>
    other.x >= r.x && other.y >= r.y && endX(other) <= endX(r) && endY(other) <= endY(r);

  const port = (
    parameters: readonly MethodParameter[],
    body: (r: Rect2, args: readonly CastArgument[]) => Variant
  ) => methodPort(parameters, (base, args) => body(base.value as Rect2, args));
  const rectAt = (args: readonly CastArgument[], index: number) => (args[index] as Variant).value as Rect2;
  const pointAt = (args: readonly CastArgument[], index: number) => componentsOf(args[index] as Variant);
  const scalarAt = (args: readonly CastArgument[], index: number) => args[index] as number;

  return {
    get_center: port([], (r) =>
      vectorOf(
        point,
        type === 'RECT2'
          ? [add(r.x, Math.fround(r.w * 0.5)), add(r.y, Math.fround(r.h * 0.5))]
          : [add(r.x, (r.w / 2) | 0), add(r.y, (r.h / 2) | 0)]
      )
    ),
    get_area: port([], (r) =>
      type === 'RECT2'
        ? variant('FLOAT', Math.fround(r.w * r.h))
        : variant('INT', BigInt(Math.imul(r.w, r.h)))
    ),
    has_area: port([], (r) => bool(r.w > 0 && r.h > 0)),
    has_point: port([point], (r, args) => bool(hasPoint(r, pointAt(args, 0)))),
    encloses: port([type], (r, args) => bool(encloses(r, rectAt(args, 0)))),
    intersection: port([type], (r, args) => rectOf(intersection(r, rectAt(args, 0)))),
    merge: port([type], (r, args) => rectOf(merge(r, rectAt(args, 0)))),
    expand: port([point], (r, args) => rectOf(expand(r, pointAt(args, 0)))),
    grow: port([scalar], (r, args) => {
      const amount = scalarAt(args, 0);
      return rectOf({
        x: subtract(r.x, amount),
        y: subtract(r.y, amount),
        w: add(r.w, twice(amount)),
        h: add(r.h, twice(amount)),
      });
    }),
    grow_side: port(['Side', scalar], (r, args) => rectOf(growSide(r, scalarAt(args, 0), scalarAt(args, 1)))),
    grow_individual: port([scalar, scalar, scalar, scalar], (r, args) => {
      const [left, top, right, bottom] = [0, 1, 2, 3].map((index) => scalarAt(args, index));
      return rectOf(growIndividual(r, left!, top!, right!, bottom!));
    }),
    abs: port([], (r) =>
      rectOf({ x: add(r.x, cMin(r.w, 0)), y: add(r.y, cMin(r.h, 0)), w: absolute(r.w), h: absolute(r.h) })
    ),
    intersects:
      type === 'RECT2'
        ? port([type, 'bool'], (r, args) => bool(intersects(r, rectAt(args, 0), args[1] as boolean)))
        : port([type], (r, args) => bool(intersects(r, rectAt(args, 0), false))),
  };
}

const isFinite = (r: Rect2) => [r.x, r.y, r.w, r.h].every(Number.isFinite);
const isEqualApprox = (r: Rect2, other: Rect2) =>
  isEqualApproxf(r.x, other.x) &&
  isEqualApproxf(r.y, other.y) &&
  isEqualApproxf(r.w, other.w) &&
  isEqualApproxf(r.h, other.h);

export const RECT2_METHODS: Readonly<Record<string, MethodPort>> = {
  ...rectMethods(FLOAT_RECT),
  is_equal_approx: methodPort(['RECT2'], (base, [other]) =>
    bool(isEqualApprox(base.value as Rect2, (other as Variant).value as Rect2))
  ),
  is_finite: methodPort([], (base) => bool(isFinite(base.value as Rect2))),
  get_support: methodPort(['VECTOR2'], (base, [direction]) => {
    const r = base.value as Rect2;
    const [dx, dy] = componentsOf(direction as Variant);
    return vectorOf('VECTOR2', [
      dx! > 0 ? Math.fround(r.x + r.w) : r.x,
      dy! > 0 ? Math.fround(r.y + r.h) : r.y,
    ]);
  }),
};

export const RECT2I_METHODS = rectMethods(INT_RECT);
