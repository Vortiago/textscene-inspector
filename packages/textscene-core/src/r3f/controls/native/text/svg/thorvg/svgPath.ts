/**
 * ThorVG's SVG path data reader (`tvgSvgPath.cpp`): the `d` attribute as move, line and cubic
 * commands. Quadratic curves become cubics and an arc becomes cubics of under 90 degrees each.
 * Every value stays in single precision, as ThorVG computes it.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { atan2, deg2rad, f32, isEqual, isZero, MATH_PI, MATH_PI2, type Point } from './math';
import { PathCommand, type RenderPath } from './renderPath';
import { strToFloat } from './strToFloat';
import { skipComma } from './svgValues';

/** The reader's place in the path: the current point, the last control point and the subpath start. */
interface PathCursor {
  cur: Point;
  curCtl: Point;
  startPoint: Point;
  isQuadratic: boolean;
  closed: boolean;
}

/** The numbers each command takes (`_numberCount`). `E` takes six and then fails, as in ThorVG. */
const NUMBER_COUNTS: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  T: 2,
  C: 6,
  E: 6,
  H: 1,
  V: 1,
  S: 4,
  Q: 4,
  A: 7,
};

const ONE_THIRD = f32(1 / 3);
const FOUR_THIRDS = f32(4 / 3);

const isAlpha = (character: string | undefined): boolean =>
  character !== undefined && /^[A-Za-z]$/.test(character);

/**
 * `svgPathToShape`: appends the commands of `text` to `path`, as far as they read. False where the
 * first command it appends is not a move, which ThorVG reports as a failed path.
 */
export function svgPathToShape(text: string, path: RenderPath): boolean {
  const cursor: PathCursor = {
    cur: { x: 0, y: 0 },
    curCtl: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
    isQuadratic: false,
    closed: false,
  };
  const command = { name: '', count: 0, numbers: [0, 0, 0, 0, 0, 0, 0] };
  const firstCommand = path.cmds.length;
  let at = 0;
  while (at < text.length) {
    const next = nextCommand(text, at, command, cursor.closed);
    if (next === null) break;
    at = next;
    cursor.closed = false;
    if (!processCommand(path, command.name, command.numbers, command.count, cursor)) break;
  }
  return path.cmds.length === firstCommand || path.cmds[firstCommand] === PathCommand.MoveTo;
}

/** `_parseFlag`: an arc flag, which is a single `0` or `1`. */
function parseFlag(text: string, at: number): { value: number; next: number } | null {
  const character = text[at];
  if (character !== '0' && character !== '1') return null;
  return { value: character === '1' ? 1 : 0, next: skipComma(text, at + 1) };
}

/** `_parseNumber`: a number and where the next starts past a comma, or null where none starts here. */
function parseNumber(text: string, at: number): { value: number; next: number } | null {
  const { value, end } = strToFloat(text, at);
  return end === at ? null : { value, next: skipComma(text, end) };
}

/**
 * `_nextCommand`: reads the next command's letter and numbers into `command`, and answers where
 * the read ended, or null where it fails. Numbers with no letter repeat the last command, a move
 * repeating as a line, and end the path after a close.
 */
function nextCommand(
  text: string,
  at: number,
  command: { name: string; count: number; numbers: number[] },
  closed: boolean
): number | null {
  at = skipComma(text, at);
  if (isAlpha(text[at])) {
    command.name = text[at]!;
    command.count = NUMBER_COUNTS[command.name.toUpperCase()] ?? 0;
    at++;
  } else if (command.name === 'm') command.name = 'l';
  else if (command.name === 'M') command.name = 'L';
  else if (closed) return null;
  const numbers = command.numbers;
  if (command.count === 7) {
    const read = readArc(text, at, numbers);
    if (read === null) command.count = 0;
    return read;
  }
  for (let i = 0; i < command.count; i++) {
    const number = parseNumber(text, at);
    if (!number) {
      command.count = 0;
      return null;
    }
    numbers[i] = number.value;
    at = skipComma(text, number.next);
  }
  return at;
}

/** The seven values of an arc, its two flags among them, or null where one does not read. */
function readArc(text: string, at: number, numbers: number[]): number | null {
  const readers = [parseNumber, parseNumber, parseNumber, parseFlag, parseFlag, parseNumber, parseNumber];
  for (const [i, reader] of readers.entries()) {
    const read = reader(text, at);
    if (!read) return null;
    numbers[i] = read.value;
    at = read.next;
  }
  return at;
}

/** Makes the coordinates of a relative command absolute (`_processCommand`, its first switch). */
function toAbsolute(name: string, arr: number[], count: number, cur: Point): void {
  switch (name) {
    case 'm':
    case 'l':
    case 'c':
    case 's':
    case 'q':
    case 't':
      for (let i = 0; i < count - 1; i += 2) {
        arr[i] = f32(arr[i]! + cur.x);
        arr[i + 1] = f32(arr[i + 1]! + cur.y);
      }
      break;
    case 'h':
      arr[0] = f32(arr[0]! + cur.x);
      break;
    case 'v':
      arr[0] = f32(arr[0]! + cur.y);
      break;
    case 'a':
      arr[5] = f32(arr[5]! + cur.x);
      arr[6] = f32(arr[6]! + cur.y);
      break;
  }
}

function pushCubic(path: RenderPath, c1: Point, c2: Point, end: Point): void {
  path.cmds.push(PathCommand.CubicTo);
  path.pts.push(c1, c2, end);
}

/** The control point a smooth curve reflects, or the current point where the last command is no curve of its kind. */
function reflectedControl(path: RenderPath, cursor: PathCursor, isQuadratic: boolean): Point {
  const followsCurve =
    path.cmds.length > 1 && path.cmds.at(-1) === PathCommand.CubicTo && cursor.isQuadratic === isQuadratic;
  if (!followsCurve) return { ...cursor.cur };
  return { x: f32(f32(2 * cursor.cur.x) - cursor.curCtl.x), y: f32(f32(2 * cursor.cur.y) - cursor.curCtl.y) };
}

/** A quadratic from the current point through `ctrl` to `end`, as a cubic. */
function pushQuadratic(path: RenderPath, cursor: PathCursor, ctrl: Point, end: Point): void {
  const third = (from: number, control: number): number => f32(f32(from + f32(2 * control)) * ONE_THIRD);
  pushCubic(
    path,
    { x: third(cursor.cur.x, ctrl.x), y: third(cursor.cur.y, ctrl.y) },
    { x: third(end.x, ctrl.x), y: third(end.y, ctrl.y) },
    end
  );
  cursor.cur = end;
  cursor.isQuadratic = true;
}

/** `_processCommand`: appends one command, or answers false for a letter that is no command. */
function processCommand(
  path: RenderPath,
  name: string,
  arr: number[],
  count: number,
  cursor: PathCursor
): boolean {
  toAbsolute(name, arr, count, cursor.cur);
  switch (name.toUpperCase()) {
    case 'M':
      path.cmds.push(PathCommand.MoveTo);
      path.pts.push({ x: arr[0]!, y: arr[1]! });
      cursor.cur = { x: arr[0]!, y: arr[1]! };
      cursor.startPoint = { x: arr[0]!, y: arr[1]! };
      return true;
    case 'L':
      path.cmds.push(PathCommand.LineTo);
      path.pts.push({ x: arr[0]!, y: arr[1]! });
      cursor.cur = { x: arr[0]!, y: arr[1]! };
      return true;
    case 'C':
      pushCubic(path, { x: arr[0]!, y: arr[1]! }, { x: arr[2]!, y: arr[3]! }, { x: arr[4]!, y: arr[5]! });
      cursor.curCtl = { x: arr[2]!, y: arr[3]! };
      cursor.cur = { x: arr[4]!, y: arr[5]! };
      cursor.isQuadratic = false;
      return true;
    case 'S':
      pushCubic(
        path,
        reflectedControl(path, cursor, false),
        { x: arr[0]!, y: arr[1]! },
        { x: arr[2]!, y: arr[3]! }
      );
      cursor.curCtl = { x: arr[0]!, y: arr[1]! };
      cursor.cur = { x: arr[2]!, y: arr[3]! };
      cursor.isQuadratic = false;
      return true;
    case 'Q': {
      const ctrl = { x: arr[0]!, y: arr[1]! };
      pushQuadratic(path, cursor, ctrl, { x: arr[2]!, y: arr[3]! });
      cursor.curCtl = ctrl;
      return true;
    }
    case 'T': {
      const ctrl = reflectedControl(path, cursor, true);
      pushQuadratic(path, cursor, ctrl, { x: arr[0]!, y: arr[1]! });
      cursor.curCtl = ctrl;
      return true;
    }
    case 'H':
      path.cmds.push(PathCommand.LineTo);
      path.pts.push({ x: arr[0]!, y: cursor.cur.y });
      cursor.cur = { x: arr[0]!, y: cursor.cur.y };
      return true;
    case 'V':
      path.cmds.push(PathCommand.LineTo);
      path.pts.push({ x: cursor.cur.x, y: arr[0]! });
      cursor.cur = { x: cursor.cur.x, y: arr[0]! };
      return true;
    case 'Z':
      path.cmds.push(PathCommand.Close);
      cursor.cur = { ...cursor.startPoint };
      cursor.closed = true;
      return true;
    case 'A':
      appendArcCommand(path, arr, cursor);
      return true;
    default:
      return false;
  }
}

/** An arc with a zero radius draws a line, and one that ends where it starts draws nothing. */
function appendArcCommand(path: RenderPath, arr: number[], cursor: PathCursor): void {
  const end = { x: arr[5]!, y: arr[6]! };
  if (isZero(arr[0]!) || isZero(arr[1]!)) {
    path.cmds.push(PathCommand.LineTo);
    path.pts.push(end);
    cursor.cur = end;
    return;
  }
  if (isEqual(cursor.cur.x, end.x) && isEqual(cursor.cur.y, end.y)) return;
  appendArcTo(
    path,
    cursor.cur,
    end,
    Math.abs(arr[0]!),
    Math.abs(arr[1]!),
    arr[2]!,
    arr[3] !== 0,
    arr[4] !== 0
  );
  cursor.cur = end;
  cursor.curCtl = { ...end };
  cursor.isQuadratic = false;
}

const cosf = (x: number): number => f32(Math.cos(x));
const sinf = (x: number): number => f32(Math.sin(x));
const sqrtf = (x: number): number => f32(Math.sqrt(x));

/** The centre and radii of an arc (SVG implementation notes F.6.5 and F.6.6), in single precision. */
function arcCentre(
  start: Point,
  end: Point,
  radiusX: number,
  radiusY: number,
  cosPhi: number,
  sinPhi: number,
  largeArc: boolean,
  sweep: boolean
) {
  let rx = radiusX;
  let ry = radiusY;
  const dx2 = f32(f32(start.x - end.x) / 2);
  const dy2 = f32(f32(start.y - end.y) / 2);
  const x1p = f32(f32(cosPhi * dx2) + f32(sinPhi * dy2));
  const y1p = f32(f32(cosPhi * dy2) - f32(sinPhi * dx2));
  const x1p2 = f32(x1p * x1p);
  const y1p2 = f32(y1p * y1p);
  let rx2 = f32(rx * rx);
  let ry2 = f32(ry * ry);
  const lambda = f32(f32(x1p2 / rx2) + f32(y1p2 / ry2));
  if (lambda > 1) {
    const lambdaRoot = sqrtf(lambda);
    rx = f32(rx * lambdaRoot);
    ry = f32(ry * lambdaRoot);
    rx2 = f32(rx * rx);
    ry2 = f32(ry * ry);
  }
  let c = f32(f32(f32(rx2 * ry2) - f32(rx2 * y1p2)) - f32(ry2 * x1p2));
  let cxp = 0;
  let cyp = 0;
  let cx = 0;
  let cy = 0;
  if (c < 0) {
    // No centre solves the radii: scale them until one does.
    const scale = sqrtf(f32(1 - f32(c / f32(rx2 * ry2))));
    rx = f32(rx * scale);
    ry = f32(ry * scale);
  } else {
    c = sqrtf(f32(c / f32(f32(rx2 * y1p2) + f32(ry2 * x1p2))));
    if (largeArc === sweep) c = -c;
    cxp = f32(c * f32(f32(rx * y1p) / ry));
    cyp = f32(c * f32(f32(-ry * x1p) / rx));
    cx = f32(f32(cosPhi * cxp) - f32(sinPhi * cyp));
    cy = f32(f32(sinPhi * cxp) + f32(cosPhi * cyp));
  }
  cx = f32(cx + f32(f32(start.x + end.x) / 2));
  cy = f32(cy + f32(f32(start.y + end.y) / 2));
  return { cx, cy, rx, ry, x1p, y1p, cxp, cyp };
}

/** `_pathAppendArcTo`: the arc from `start` to `end` as cubics of under 90 degrees each. */
function appendArcTo(
  path: RenderPath,
  start: Point,
  end: Point,
  radiusX: number,
  radiusY: number,
  angle: number,
  largeArc: boolean,
  sweep: boolean
): void {
  const phi = deg2rad(angle);
  const cosPhi = cosf(phi);
  const sinPhi = sinf(phi);
  const { cx, cy, rx, ry, x1p, y1p, cxp, cyp } = arcCentre(
    start,
    end,
    radiusX,
    radiusY,
    cosPhi,
    sinPhi,
    largeArc,
    sweep
  );
  const TWO_PI = f32(2 * MATH_PI);
  const at = atan2(f32(f32(y1p - cyp) / ry), f32(f32(x1p - cxp) / rx));
  let theta1 = at < 0 ? f32(TWO_PI + at) : at;
  const nat = atan2(f32(f32(-y1p - cyp) / ry), f32(f32(-x1p - cxp) / rx));
  let deltaTheta = nat < at ? f32(f32(TWO_PI - at) + nat) : f32(nat - at);
  if (sweep) {
    if (deltaTheta < 0) deltaTheta = f32(deltaTheta + TWO_PI);
  } else if (deltaTheta > 0) deltaTheta = f32(deltaTheta - TWO_PI);
  // One segment more than the quarter turns, so that each is under 90 degrees.
  const segments = Math.trunc(f32(Math.abs(f32(deltaTheta / MATH_PI2)) + 1));
  const delta = f32(deltaTheta / segments);
  const halfDelta = f32(delta / 2);
  const bcp = f32(f32(FOUR_THIRDS * f32(1 - cosf(halfDelta))) / sinf(halfDelta));
  const cosPhiRx = f32(cosPhi * rx);
  const cosPhiRy = f32(cosPhi * ry);
  const sinPhiRx = f32(sinPhi * rx);
  const sinPhiRy = f32(sinPhi * ry);
  let sx = start.x;
  let sy = start.y;
  let cosTheta1 = cosf(theta1);
  let sinTheta1 = sinf(theta1);
  for (let i = 0; i < segments; i++) {
    const theta2 = f32(theta1 + delta);
    const cosTheta2 = cosf(theta2);
    const sinTheta2 = sinf(theta2);
    const c1 = {
      x: f32(sx - f32(bcp * f32(f32(cosPhiRx * sinTheta1) + f32(sinPhiRy * cosTheta1)))),
      y: f32(sy + f32(bcp * f32(f32(cosPhiRy * cosTheta1) - f32(sinPhiRx * sinTheta1)))),
    };
    const e = {
      x: f32(cx + f32(f32(cosPhiRx * cosTheta2) - f32(sinPhiRy * sinTheta2))),
      y: f32(cy + f32(f32(sinPhiRx * cosTheta2) + f32(cosPhiRy * sinTheta2))),
    };
    const c2 = {
      x: f32(e.x + f32(bcp * f32(f32(cosPhiRx * sinTheta2) + f32(sinPhiRy * cosTheta2)))),
      y: f32(e.y + f32(bcp * f32(f32(sinPhiRx * sinTheta2) - f32(cosPhiRy * cosTheta2)))),
    };
    pushCubic(path, c1, c2, e);
    sx = e.x;
    sy = e.y;
    theta1 = theta2;
    cosTheta1 = cosTheta2;
    sinTheta1 = sinTheta2;
  }
}
