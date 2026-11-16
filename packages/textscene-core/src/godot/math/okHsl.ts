// Portions ported from `thirdparty/misc/ok_color.h` (MIT, Copyright (c) 2021 Björn Ottosson). See THIRD-PARTY-NOTICES.md.
import { linearSrgbToOklab, oklabToLinearSrgb } from './okLab.js';

const f = Math.fround;
const PI = f(Math.PI);
const FLT_MAX = f(3.4028234663852886e38);

interface LC {
  readonly L: number;
  readonly C: number;
}

/** Gamma-encoded sRGB channels, as a Godot `Color` holds them. */
export interface SrgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Okhsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

// Each product and sum rounds to float, as the header's `float` maths does, left to right.
const mul = (...factors: number[]) => factors.reduce((product, factor) => f(product * factor));
const sum = (...terms: number[]) => terms.reduce((total, term) => f(total + term));

// C's fmin and fmax return the other operand where one is NaN, where Math.min and Math.max return NaN.
const fmin = (a: number, b: number) => (Number.isNaN(a) ? b : Number.isNaN(b) ? a : Math.min(a, b));
const fmax = (a: number, b: number) => (Number.isNaN(a) ? b : Number.isNaN(b) ? a : Math.max(a, b));

function srgbTransferFunctionInv(a: number): number {
  return f(0.04045) < a ? f(Math.pow(f(f(a + f(0.055)) / f(1.055)), f(2.4))) : f(a / f(12.92));
}

/** `compute_max_saturation` (ok_color.h:104), for `a` and `b` normalised. */
function computeMaxSaturation(a: number, b: number): number {
  let k: readonly number[];
  let w: readonly number[];
  if (sum(mul(f(-1.88170328), a), -mul(f(0.80936493), b)) > 1) {
    k = [1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245];
    w = [4.0767416621, -3.3077115913, 0.2309699292];
  } else if (sum(mul(f(1.81444104), a), -mul(f(1.19445276), b)) > 1) {
    k = [0.73956515, -0.45954404, 0.08285427, 0.1254107, 0.14503204];
    w = [-1.2684380046, 2.6097574011, -0.3413193965];
  } else {
    k = [1.35733652, -0.00915799, -1.1513021, -0.50559606, 0.00692167];
    w = [-0.0041960863, -0.7034186147, 1.707614701];
  }
  const [k0, k1, k2, k3, k4] = k.map(f) as [number, number, number, number, number];
  const [wl, wm, ws] = w.map(f) as [number, number, number];
  let S = sum(k0, mul(k1, a), mul(k2, b), mul(k3, a, a), mul(k4, a, b));
  const kl = sum(mul(f(0.3963377774), a), mul(f(0.2158037573), b));
  const km = sum(mul(f(-0.1055613458), a), -mul(f(0.0638541728), b));
  const ks = sum(mul(f(-0.0894841775), a), -mul(f(1.291485548), b));
  const l_ = sum(1, mul(S, kl));
  const m_ = sum(1, mul(S, km));
  const s_ = sum(1, mul(S, ks));
  const [l, m, s] = [mul(l_, l_, l_), mul(m_, m_, m_), mul(s_, s_, s_)];
  const [ldS, mdS, sdS] = [mul(3, kl, l_, l_), mul(3, km, m_, m_), mul(3, ks, s_, s_)];
  const [ldS2, mdS2, sdS2] = [mul(6, kl, kl, l_), mul(6, km, km, m_), mul(6, ks, ks, s_)];
  const f0 = sum(mul(wl, l), mul(wm, m), mul(ws, s));
  const f1 = sum(mul(wl, ldS), mul(wm, mdS), mul(ws, sdS));
  const f2 = sum(mul(wl, ldS2), mul(wm, mdS2), mul(ws, sdS2));
  S = f(S - f(mul(f0, f1) / f(mul(f1, f1) - mul(0.5, f0, f2))));
  return S;
}

/** `find_cusp` (ok_color.h:170). */
function findCusp(a: number, b: number): LC {
  const sCusp = computeMaxSaturation(a, b);
  const rgb = oklabToLinearSrgb({ L: 1, a: mul(sCusp, a), b: mul(sCusp, b) });
  const L = f(Math.cbrt(f(1 / fmax(fmax(rgb.r, rgb.g), rgb.b))));
  return { L, C: mul(L, sCusp) };
}

/** `find_gamut_intersection` (ok_color.h:187) with its cusp given. */
function findGamutIntersection(a: number, b: number, L1: number, C1: number, L0: number, cusp: LC): number {
  if (f(mul(f(L1 - L0), cusp.C) - mul(f(cusp.L - L0), C1)) <= 0)
    return f(mul(cusp.C, L0) / sum(mul(C1, cusp.L), mul(cusp.C, f(L0 - L1))));
  let t = f(mul(cusp.C, f(L0 - 1)) / sum(mul(C1, f(cusp.L - 1)), mul(cusp.C, f(L0 - L1))));
  const dL = f(L1 - L0);
  const kl = sum(mul(f(0.3963377774), a), mul(f(0.2158037573), b));
  const km = sum(mul(f(-0.1055613458), a), -mul(f(0.0638541728), b));
  const ks = sum(mul(f(-0.0894841775), a), -mul(f(1.291485548), b));
  const [ldt, mdt, sdt] = [sum(dL, mul(C1, kl)), sum(dL, mul(C1, km)), sum(dL, mul(C1, ks))];
  const L = sum(mul(L0, f(1 - t)), mul(t, L1));
  const C = mul(t, C1);
  const [l_, m_, s_] = [sum(L, mul(C, kl)), sum(L, mul(C, km)), sum(L, mul(C, ks))];
  const cubes = [mul(l_, l_, l_), mul(m_, m_, m_), mul(s_, s_, s_)];
  const firsts = [mul(3, ldt, l_, l_), mul(3, mdt, m_, m_), mul(3, sdt, s_, s_)];
  const seconds = [mul(6, ldt, ldt, l_), mul(6, mdt, mdt, m_), mul(6, sdt, sdt, s_)];
  const step = (w: readonly number[]) => {
    const [wl, wm, ws] = w.map(f) as [number, number, number];
    const weigh = ([l, m, s]: readonly number[]) => sum(mul(wl, l!), mul(wm, m!), mul(ws, s!));
    const r = f(weigh(cubes) - 1);
    const r1 = weigh(firsts);
    const u = f(r1 / f(mul(r1, r1) - mul(0.5, r, weigh(seconds))));
    return u >= 0 ? mul(-r, u) : FLT_MAX;
  };
  const tr = step([4.0767416621, -3.3077115913, 0.2309699292]);
  const tg = step([-1.2684380046, 2.6097574011, -0.3413193965]);
  const tb = step([-0.0041960863, -0.7034186147, 1.707614701]);
  t = f(t + fmin(tr, fmin(tg, tb)));
  return t;
}

function toe(x: number): number {
  const k1 = f(0.206);
  const k2 = f(0.03);
  const k3 = f(f(1 + k1) / f(1 + k2));
  const shifted = f(mul(k3, x) - k1);
  return mul(0.5, sum(shifted, f(Math.sqrt(sum(mul(shifted, shifted), mul(4, k2, k3, x))))));
}

function getStMid(a: number, b: number): { S: number; T: number } {
  const S = sum(
    f(0.11516993),
    f(
      1 /
        sum(
          f(7.4477897),
          mul(f(4.1590124), b),
          mul(
            a,
            sum(
              f(-2.19557347),
              mul(f(1.75198401), b),
              mul(
                a,
                sum(
                  f(-2.13704948),
                  -mul(f(10.02301043), b),
                  mul(a, sum(f(-4.24894561), mul(f(5.38770819), b), mul(f(4.69891013), a)))
                )
              )
            )
          )
        )
    )
  );
  const T = sum(
    f(0.11239642),
    f(
      1 /
        sum(
          f(1.6132032),
          -mul(f(0.68124379), b),
          mul(
            a,
            sum(
              f(0.40370612),
              mul(f(0.90148123), b),
              mul(
                a,
                sum(
                  f(-0.27087943),
                  mul(f(0.6122399), b),
                  mul(a, sum(f(0.00299215), -mul(f(0.45399568), b), -mul(f(0.14661872), a)))
                )
              )
            )
          )
        )
    )
  );
  return { S, T };
}

/** `get_Cs` (ok_color.h:451). */
function getCs(L: number, a: number, b: number): { C0: number; Cmid: number; Cmax: number } {
  const cusp = findCusp(a, b);
  const Cmax = findGamutIntersection(a, b, L, 1, L, cusp);
  const stMax = { S: f(cusp.C / cusp.L), T: f(cusp.C / f(1 - cusp.L)) };
  const k = f(Cmax / fmin(mul(L, stMax.S), mul(f(1 - L), stMax.T)));
  const stMid = getStMid(a, b);
  const midA = mul(L, stMid.S);
  const midB = mul(f(1 - L), stMid.T);
  const fourth = (x: number) => mul(x, x, x, x);
  const inner = f(1 / sum(f(1 / fourth(midA)), f(1 / fourth(midB))));
  const Cmid = mul(f(0.9), k, f(Math.sqrt(f(Math.sqrt(inner)))));
  const zeroA = mul(L, f(0.4));
  const zeroB = mul(f(1 - L), f(0.8));
  const C0 = f(Math.sqrt(f(1 / sum(f(1 / mul(zeroA, zeroA)), f(1 / mul(zeroB, zeroB))))));
  return { C0, Cmid, Cmax };
}

/** `srgb_to_okhsl` (ok_color.h:542) in float, with `powf`, `cbrtf` and `atan2f` from V8. */
export function srgbToOkhsl({ r, g, b }: SrgbColor): Okhsl {
  if (r === 0 && g === 0 && b === 0) return { h: 0, s: 0, l: 0 };
  const lab = linearSrgbToOklab({
    r: srgbTransferFunctionInv(r),
    g: srgbTransferFunctionInv(g),
    b: srgbTransferFunctionInv(b),
  });
  const C = f(Math.sqrt(sum(mul(lab.a, lab.a), mul(lab.b, lab.b))));
  const a = f(lab.a / C);
  const bn = f(lab.b / C);
  const L = lab.L;
  const h = sum(0.5, f(mul(0.5, f(Math.atan2(-lab.b, -lab.a))) / PI));
  const { C0, Cmid, Cmax } = getCs(L, a, bn);
  const mid = f(0.8);
  const midInv = f(1.25);
  let s: number;
  if (C < Cmid) {
    const k1 = mul(mid, C0);
    const k2 = f(1 - f(k1 / Cmid));
    s = mul(f(C / sum(k1, mul(k2, C))), mid);
  } else {
    const k1 = f(mul(f(1 - mid), Cmid, Cmid, midInv, midInv) / C0);
    const k2 = f(1 - f(k1 / f(Cmax - Cmid)));
    const t = f(f(C - Cmid) / sum(k1, mul(k2, f(C - Cmid))));
    s = sum(mid, mul(f(1 - mid), t));
  }
  return { h, s, l: toe(L) };
}

function srgbTransferFunction(a: number): number {
  return f(0.0031308) >= a
    ? mul(f(12.92), a)
    : f(mul(f(1.055), f(Math.pow(a, f(0.4166666666666667)))) - f(0.055));
}

function toeInv(x: number): number {
  const k1 = f(0.206);
  const k2 = f(0.03);
  const k3 = f(f(1 + k1) / f(1 + k2));
  return f(sum(mul(x, x), mul(k1, x)) / mul(k3, sum(x, k2)));
}

/** `okhsl_to_srgb` (ok_color.h:484) in float, with `powf`, `cosf` and `sinf` from V8. */
export function okhslToSrgb({ h, s, l }: Okhsl): SrgbColor {
  if (l === 1) return { r: 1, g: 1, b: 1 };
  if (l === 0) return { r: 0, g: 0, b: 0 };
  const turn = mul(2, PI, h);
  const a = f(Math.cos(turn));
  const b = f(Math.sin(turn));
  const L = toeInv(l);
  const { C0, Cmid, Cmax } = getCs(L, a, b);
  const mid = f(0.8);
  const midInv = f(1.25);
  let C: number;
  if (s < mid) {
    const t = mul(midInv, s);
    const k1 = mul(mid, C0);
    const k2 = f(1 - f(k1 / Cmid));
    C = f(mul(t, k1) / f(1 - mul(k2, t)));
  } else {
    const t = f(f(s - mid) / f(1 - mid));
    const k1 = f(mul(f(1 - mid), Cmid, Cmid, midInv, midInv) / C0);
    const k2 = f(1 - f(k1 / f(Cmax - Cmid)));
    C = sum(Cmid, f(mul(t, k1) / f(1 - mul(k2, t))));
  }
  const rgb = oklabToLinearSrgb({ L, a: mul(C, a), b: mul(C, b) });
  return { r: srgbTransferFunction(rgb.r), g: srgbTransferFunction(rgb.g), b: srgbTransferFunction(rgb.b) };
}
