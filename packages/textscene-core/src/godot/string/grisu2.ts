/**
 * Ported from Grisu2 as Godot vendors it (`thirdparty/grisu2/grisu2.h`), which carries:
 * Copyright (c) 2009 Florian Loitsch. MIT licence.
 * See THIRD-PARTY-NOTICES.md.
 */

const U64 = (1n << 64n) - 1n;

/** `f * 2^e`, with a 64-bit significand. */
interface DiyFp {
  readonly f: bigint;
  readonly e: number;
}

/** The upper 64 bits of the 128-bit product, rounded with ties up. */
const multiplied = (x: DiyFp, y: DiyFp): DiyFp => ({
  f: (x.f * y.f + (1n << 63n)) >> 64n,
  e: x.e + y.e + 64,
});

function normalized(x: DiyFp): DiyFp {
  let { f, e } = x;
  while (f >> 63n === 0n) {
    f <<= 1n;
    e--;
  }
  return { f, e };
}

const normalizedTo = (x: DiyFp, e: number): DiyFp => ({ f: (x.f << BigInt(x.e - e)) & U64, e });

/** The IEEE layout of a double or of a float: significand bits with the hidden bit, and exponent bias. */
interface FloatFormat {
  readonly precision: number;
  readonly bias: number;
  readonly bitsOf: (value: number) => bigint;
}

const view = new DataView(new ArrayBuffer(8));

const DOUBLE: FloatFormat = {
  precision: 53,
  bias: 1075,
  bitsOf: (value) => (view.setFloat64(0, value), view.getBigUint64(0)),
};

const FLOAT: FloatFormat = {
  precision: 24,
  bias: 150,
  bitsOf: (value) => (view.setFloat32(0, value), BigInt(view.getUint32(0))),
};

/** `compute_boundaries`: the value and the midpoints to its neighbours, sharing the upper one's exponent. */
function boundaries(value: number, format: FloatFormat) {
  const hiddenBit = 1n << BigInt(format.precision - 1);
  const bits = format.bitsOf(value);
  const exponent = Number(bits >> BigInt(format.precision - 1));
  const fraction = bits & (hiddenBit - 1n);
  const v: DiyFp =
    exponent === 0
      ? { f: fraction, e: 1 - format.bias }
      : { f: fraction + hiddenBit, e: exponent - format.bias };
  const isLowerBoundaryCloser = fraction === 0n && exponent > 1;
  const plus = normalized({ f: 2n * v.f + 1n, e: v.e - 1 });
  const minus = isLowerBoundaryCloser ? { f: 4n * v.f - 1n, e: v.e - 2 } : { f: 2n * v.f - 1n, e: v.e - 1 };
  return { w: normalized(v), minus: normalizedTo(minus, plus.e), plus };
}

const ALPHA = -60;
const CACHED_POWERS_MIN_DECIMAL_EXPONENT = -300;
const CACHED_POWERS_DECIMAL_STEP = 8;

/** `kCachedPowers`: `f * 2^e`, about `10^k`, every eighth power of ten from -300 to 324. */
const CACHED_POWERS: readonly (readonly [bigint, number, number])[] = [
  [0xab70fe17c79ac6can, -1060, -300],
  [0xff77b1fcbebcdc4fn, -1034, -292],
  [0xbe5691ef416bd60cn, -1007, -284],
  [0x8dd01fad907ffc3cn, -980, -276],
  [0xd3515c2831559a83n, -954, -268],
  [0x9d71ac8fada6c9b5n, -927, -260],
  [0xea9c227723ee8bcbn, -901, -252],
  [0xaecc49914078536dn, -874, -244],
  [0x823c12795db6ce57n, -847, -236],
  [0xc21094364dfb5637n, -821, -228],
  [0x9096ea6f3848984fn, -794, -220],
  [0xd77485cb25823ac7n, -768, -212],
  [0xa086cfcd97bf97f4n, -741, -204],
  [0xef340a98172aace5n, -715, -196],
  [0xb23867fb2a35b28en, -688, -188],
  [0x84c8d4dfd2c63f3bn, -661, -180],
  [0xc5dd44271ad3cdban, -635, -172],
  [0x936b9fcebb25c996n, -608, -164],
  [0xdbac6c247d62a584n, -582, -156],
  [0xa3ab66580d5fdaf6n, -555, -148],
  [0xf3e2f893dec3f126n, -529, -140],
  [0xb5b5ada8aaff80b8n, -502, -132],
  [0x87625f056c7c4a8bn, -475, -124],
  [0xc9bcff6034c13053n, -449, -116],
  [0x964e858c91ba2655n, -422, -108],
  [0xdff9772470297ebdn, -396, -100],
  [0xa6dfbd9fb8e5b88fn, -369, -92],
  [0xf8a95fcf88747d94n, -343, -84],
  [0xb94470938fa89bcfn, -316, -76],
  [0x8a08f0f8bf0f156bn, -289, -68],
  [0xcdb02555653131b6n, -263, -60],
  [0x993fe2c6d07b7facn, -236, -52],
  [0xe45c10c42a2b3b06n, -210, -44],
  [0xaa242499697392d3n, -183, -36],
  [0xfd87b5f28300ca0en, -157, -28],
  [0xbce5086492111aebn, -130, -20],
  [0x8cbccc096f5088ccn, -103, -12],
  [0xd1b71758e219652cn, -77, -4],
  [0x9c40000000000000n, -50, 4],
  [0xe8d4a51000000000n, -24, 12],
  [0xad78ebc5ac620000n, 3, 20],
  [0x813f3978f8940984n, 30, 28],
  [0xc097ce7bc90715b3n, 56, 36],
  [0x8f7e32ce7bea5c70n, 83, 44],
  [0xd5d238a4abe98068n, 109, 52],
  [0x9f4f2726179a2245n, 136, 60],
  [0xed63a231d4c4fb27n, 162, 68],
  [0xb0de65388cc8ada8n, 189, 76],
  [0x83c7088e1aab65dbn, 216, 84],
  [0xc45d1df942711d9an, 242, 92],
  [0x924d692ca61be758n, 269, 100],
  [0xda01ee641a708dean, 295, 108],
  [0xa26da3999aef774an, 322, 116],
  [0xf209787bb47d6b85n, 348, 124],
  [0xb454e4a179dd1877n, 375, 132],
  [0x865b86925b9bc5c2n, 402, 140],
  [0xc83553c5c8965d3dn, 428, 148],
  [0x952ab45cfa97a0b3n, 455, 156],
  [0xde469fbd99a05fe3n, 481, 164],
  [0xa59bc234db398c25n, 508, 172],
  [0xf6c69a72a3989f5cn, 534, 180],
  [0xb7dcbf5354e9becen, 561, 188],
  [0x88fcf317f22241e2n, 588, 196],
  [0xcc20ce9bd35c78a5n, 614, 204],
  [0x98165af37b2153dfn, 641, 212],
  [0xe2a0b5dc971f303an, 667, 220],
  [0xa8d9d1535ce3b396n, 694, 228],
  [0xfb9b7cd9a4a7443cn, 720, 236],
  [0xbb764c4ca7a44410n, 747, 244],
  [0x8bab8eefb6409c1an, 774, 252],
  [0xd01fef10a657842cn, 800, 260],
  [0x9b10a4e5e9913129n, 827, 268],
  [0xe7109bfba19c0c9dn, 853, 276],
  [0xac2820d9623bf429n, 880, 284],
  [0x80444b5e7aa7cf85n, 907, 292],
  [0xbf21e44003acdd2dn, 933, 300],
  [0x8e679c2f5e44ff8fn, 960, 308],
  [0xd433179d9c8cb841n, 986, 316],
  [0x9e19db92b4e31ba9n, 1013, 324],
];

/** `get_cached_power_for_binary_exponent`: a power of ten that brings `w * c` into exponents -60 to -32. */
function cachedPower(e: number) {
  const f = ALPHA - e - 1;
  const k = Math.trunc((f * 78913) / (1 << 18)) + (f > 0 ? 1 : 0);
  const index = Math.trunc(
    (-CACHED_POWERS_MIN_DECIMAL_EXPONENT + k + (CACHED_POWERS_DECIMAL_STEP - 1)) / CACHED_POWERS_DECIMAL_STEP
  );
  const [cachedF, cachedE, cachedK] = CACHED_POWERS[index]!;
  return { power: { f: cachedF, e: cachedE }, k: cachedK };
}

/** `find_largest_pow10`: the digit count of `n`, 1 for 0. */
const digitCount = (n: number): number => String(n).length;

/** `grisu2_round`: steps the last digit down while that brings the digits closer to the value. */
function roundDown(digits: number[], dist: bigint, delta: bigint, rest: bigint, tenK: bigint): void {
  while (rest < dist && delta - rest >= tenK && (rest + tenK < dist || dist - rest > rest + tenK - dist)) {
    digits[digits.length - 1]!--;
    rest += tenK;
  }
}

/** `grisu2_digit_gen`: the digits between M- and M+, and the decimal exponent of the last one. */
function generatedDigits(minus: DiyFp, w: DiyFp, plus: DiyFp, decimalExponent: number) {
  let delta = plus.f - minus.f;
  let dist = plus.f - w.f;
  const shift = BigInt(-plus.e);
  const one = 1n << shift;
  let p1 = Number(plus.f >> shift);
  let p2 = plus.f & (one - 1n);
  const digits: number[] = [];
  let n = digitCount(p1);
  let pow10 = 10 ** (n - 1);
  while (n > 0) {
    digits.push(Math.trunc(p1 / pow10));
    p1 %= pow10;
    n--;
    const rest = (BigInt(p1) << shift) + p2;
    if (rest <= delta) {
      roundDown(digits, dist, delta, rest, BigInt(pow10) << shift);
      return { digits, exponent: decimalExponent + n };
    }
    pow10 /= 10;
  }
  let m = 0;
  for (;;) {
    p2 *= 10n;
    digits.push(Number(p2 >> shift));
    p2 &= one - 1n;
    m++;
    delta = (delta * 10n) & U64;
    dist = (dist * 10n) & U64;
    if (p2 <= delta) break;
  }
  roundDown(digits, dist, delta, p2, one);
  return { digits, exponent: decimalExponent - m };
}

/** `grisu2_core`: the digits and decimal exponent of a positive finite value. */
function grisu2(value: number, format: FloatFormat) {
  const { w, minus, plus } = boundaries(value, format);
  const { power, k } = cachedPower(plus.e);
  const scaledMinus = multiplied(minus, power);
  const scaledPlus = multiplied(plus, power);
  return generatedDigits(
    { f: scaledMinus.f + 1n, e: scaledMinus.e },
    multiplied(w, power),
    { f: scaledPlus.f - 1n, e: scaledPlus.e },
    -k
  );
}

const EXPONENT_MIN = -4;
const EXPONENT_MAX = 15;

/** `append_exponent`: a sign and at least two digits. */
const exponentText = (e: number): string => `${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;

/** `format_buffer`: decimal notation for magnitudes from 1e-4 below 1e15, scientific notation outside. */
function laidOut(digits: string, decimalExponent: number): string {
  const k = digits.length;
  const n = k + decimalExponent;
  if (k <= n && n <= EXPONENT_MAX) return digits + '0'.repeat(n - k);
  if (0 < n && n <= EXPONENT_MAX) return `${digits.slice(0, n)}.${digits.slice(n)}`;
  if (EXPONENT_MIN < n && n <= 0) return `0.${'0'.repeat(-n)}${digits}`;
  const mantissa = k === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
  return `${mantissa}e${exponentText(n - 1)}`;
}

function toChars(value: number, format: FloatFormat): string {
  const sign = value < 0 || Object.is(value, -0) ? '-' : '';
  const magnitude = Math.abs(value);
  if (magnitude === 0) return `${sign}0`;
  const { digits, exponent } = grisu2(magnitude, format);
  return sign + laidOut(digits.join(''), exponent);
}

/** `grisu2::to_chars` of a finite double. */
export const doubleChars = (value: number): string => toChars(value, DOUBLE);

/** `grisu2::to_chars` of a finite float. */
export const floatChars = (value: number): string => toChars(value, FLOAT);
