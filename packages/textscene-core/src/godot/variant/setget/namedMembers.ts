import { basisColumn } from '../../math/basis.js';
import { colorHue, colorSaturation, colorValue } from '../../math/color.js';
import { round } from '../../math/math.js';
import { srgbToOkhsl, type Okhsl } from '../../math/okHsl.js';
import { basisOfTransform3D } from '../../math/transform3d.js';
import { variant, type Variant, type VariantOf, type VariantTypeName } from '../value/variant.js';

type Getter<T extends VariantTypeName> = (value: VariantOf<T>['value']) => Variant;
type MemberTable = { readonly [T in VariantTypeName]?: Readonly<Record<string, Getter<T>>> };

const f = Math.fround;
const real = (value: number) => variant('FLOAT', value);
const int = (value: number) => variant('INT', BigInt(value));
const vector2 = (x: number, y: number) => variant('VECTOR2', { x, y });
const vector3 = (x: number, y: number, z: number) => variant('VECTOR3', { x, y, z });

// color.h:228: a NaN channel passes CLAMP, and int32_t of it is x86's INT32_MIN.
const channel8 = (channel: number) => {
  const scaled = round(f(channel * 255));
  if (Number.isNaN(scaled)) return int(-0x80000000);
  return int(scaled < 0 ? 0 : scaled > 255 ? 255 : scaled);
};

// color.cpp:498: a NaN part of the OKHSL colour reads 0, and the rest clamps to [0, 1].
const okhslPart = (rgb: Readonly<{ r: number; g: number; b: number }>, part: keyof Okhsl) => {
  const value = srgbToOkhsl(rgb)[part];
  if (Number.isNaN(value)) return real(0);
  return real(value < 0 ? 0 : value > 1 ? 1 : value);
};

/** `register_named_setters_getters` (variant_setget.cpp:66): each type's members and how each reads. */
const MEMBERS: MemberTable = {
  VECTOR2: { x: (v) => real(v.x), y: (v) => real(v.y) },
  VECTOR2I: { x: (v) => int(v.x), y: (v) => int(v.y) },
  VECTOR3: { x: (v) => real(v.x), y: (v) => real(v.y), z: (v) => real(v.z) },
  VECTOR3I: { x: (v) => int(v.x), y: (v) => int(v.y), z: (v) => int(v.z) },
  VECTOR4: { x: (v) => real(v.x), y: (v) => real(v.y), z: (v) => real(v.z), w: (v) => real(v.w) },
  VECTOR4I: { x: (v) => int(v.x), y: (v) => int(v.y), z: (v) => int(v.z), w: (v) => int(v.w) },
  RECT2: {
    position: (r) => vector2(r.x, r.y),
    size: (r) => vector2(r.w, r.h),
    end: (r) => vector2(f(r.x + r.w), f(r.y + r.h)),
  },
  RECT2I: {
    position: (r) => variant('VECTOR2I', { x: r.x, y: r.y }),
    size: (r) => variant('VECTOR2I', { x: r.w, y: r.h }),
    end: (r) => variant('VECTOR2I', { x: (r.x + r.w) | 0, y: (r.y + r.h) | 0 }),
  },
  AABB: {
    position: ({ position: p }) => vector3(p.x, p.y, p.z),
    size: ({ size: s }) => vector3(s.x, s.y, s.z),
    end: ({ position: p, size: s }) => vector3(f(p.x + s.x), f(p.y + s.y), f(p.z + s.z)),
  },
  TRANSFORM2D: {
    x: (t) => vector2(t.a, t.b),
    y: (t) => vector2(t.c, t.d),
    origin: (t) => vector2(t.tx, t.ty),
  },
  PLANE: {
    x: (p) => real(p.normal.x),
    y: (p) => real(p.normal.y),
    z: (p) => real(p.normal.z),
    normal: (p) => vector3(p.normal.x, p.normal.y, p.normal.z),
    d: (p) => real(p.d),
  },
  QUATERNION: { x: (q) => real(q.x), y: (q) => real(q.y), z: (q) => real(q.z), w: (q) => real(q.w) },
  BASIS: {
    x: (b) => vector3(...basisColumn(b, 0)),
    y: (b) => vector3(...basisColumn(b, 1)),
    z: (b) => vector3(...basisColumn(b, 2)),
  },
  TRANSFORM3D: {
    basis: (t) => variant('BASIS', basisOfTransform3D(t)),
    origin: ({ origin: o }) => vector3(o.x, o.y, o.z),
  },
  PROJECTION: {
    x: (p) => variant('VECTOR4', p[0]),
    y: (p) => variant('VECTOR4', p[1]),
    z: (p) => variant('VECTOR4', p[2]),
    w: (p) => variant('VECTOR4', p[3]),
  },
  COLOR: {
    r: (c) => real(c.r),
    g: (c) => real(c.g),
    b: (c) => real(c.b),
    a: (c) => real(c.a),
    r8: (c) => channel8(c.r),
    g8: (c) => channel8(c.g),
    b8: (c) => channel8(c.b),
    a8: (c) => channel8(c.a),
    h: (c) => real(colorHue(c)),
    s: (c) => real(colorSaturation(c)),
    v: (c) => real(colorValue(c)),
    ok_hsl_h: (c) => okhslPart(c, 'h'),
    ok_hsl_s: (c) => okhslPart(c, 's'),
    ok_hsl_l: (c) => okhslPart(c, 'l'),
  },
};

/** The member `name` of `value` (variant_setget.cpp:267), or nothing where its type has no such member. */
export function memberOf(value: Variant, name: string): Variant | undefined {
  const getter = (MEMBERS[value.type] as Readonly<Record<string, Getter<VariantTypeName>>> | undefined)?.[
    name
  ];
  return getter && Object.hasOwn(MEMBERS[value.type]!, name) ? getter(value.value as never) : undefined;
}
