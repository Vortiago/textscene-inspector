/**
 * ThorVG's transform list reader (`_parseTransformationMatrix`, `tvgSvgLoader.cpp`): the matrix a
 * `transform` attribute sets, or null for a list ThorVG rejects.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { deg2rad, f32, identityMatrix, matrix, multiply, type Matrix } from './math';
import { isSpace } from './strToFloat';
import { parseNumbersArray, skipSpace } from './svgNumbers';

const TRANSFORMS = ['matrix', 'translate', 'rotate', 'scale', 'skewX', 'skewY'] as const;

/** The most numbers a transform function reads (`POINT_CNT`). */
const MAX_TRANSFORM_NUMBERS = 8;

/** `_parseTransformationMatrix`: the product of a transform list, or null for one ThorVG rejects. */
export function parseTransform(text: string): Matrix | null {
  let m = identityMatrix();
  let at = 0;
  while (at < text.length) {
    if (isSpace(text[at]) || text[at] === ',') {
      at++;
      continue;
    }
    const name = TRANSFORMS.find((candidate) => text.startsWith(candidate, at));
    if (!name) return null;
    at = skipSpace(text, at + name.length);
    if (text[at] !== '(') return null;
    const { numbers, end } = parseNumbersArray(text, at + 1, MAX_TRANSFORM_NUMBERS);
    if (text[end] !== ')') return null;
    at = end + 1;
    const step = transformStep(name, numbers);
    if (!step) return null;
    for (const factor of step) m = multiply(m, factor);
  }
  return m;
}

/** The matrices one transform function multiplies in, or null for the wrong count of numbers. */
function transformStep(name: (typeof TRANSFORMS)[number], p: number[]): Matrix[] | null {
  const count = p.length;
  switch (name) {
    case 'matrix':
      return count === 6 ? [matrix(p[0]!, p[2]!, p[4]!, p[1]!, p[3]!, p[5]!, 0, 0, 1)] : null;
    case 'translate':
      if (count === 1) return [matrix(1, 0, p[0]!, 0, 1, 0, 0, 0, 1)];
      return count === 2 ? [matrix(1, 0, p[0]!, 0, 1, p[1]!, 0, 0, 1)] : null;
    case 'rotate':
      return rotation(p);
    case 'scale':
      if (count < 1 || count > 2) return null;
      return [matrix(p[0]!, 0, 0, 0, count === 2 ? p[1]! : p[0]!, 0, 0, 0, 1)];
    case 'skewX':
      return count === 1 ? [matrix(1, f32(Math.tan(deg2rad(p[0]!))), 0, 0, 1, 0, 0, 0, 1)] : null;
    case 'skewY':
      return count === 1 ? [matrix(1, 0, 0, f32(Math.tan(deg2rad(p[0]!))), 1, 0, 0, 0, 1)] : null;
  }
}

/** `rotate(a)` or `rotate(a, x, y)`, its angle first brought into 0 to 360. */
function rotation(p: number[]): Matrix[] | null {
  if (p.length !== 1 && p.length !== 3) return null;
  let degrees = f32(p[0]! % 360);
  if (degrees < 0) degrees = f32(degrees + 360);
  const c = f32(Math.cos(deg2rad(degrees)));
  const s = f32(Math.sin(deg2rad(degrees)));
  const turn = matrix(c, -s, 0, s, c, 0, 0, 0, 1);
  if (p.length === 1) return [turn];
  return [matrix(1, 0, p[1]!, 0, 1, p[2]!, 0, 0, 1), turn, matrix(1, 0, -p[1]!, 0, 1, -p[2]!, 0, 0, 1)];
}
