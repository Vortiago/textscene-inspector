import {
  add,
  bitAnd,
  bitNot,
  bitOr,
  bitXor,
  convert,
  equal,
  lessThan,
  mul,
  select,
  shiftLeft,
  shiftRight,
  sub,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { chained, type Composite, intNode, tsl, unsignedNode, withScalar } from './compositeParts.js';

// The inner convert stops three writing a negative constant as `0u`.
const as = (x: Node, from: string, to: string) => tsl(convert)(tsl(convert)(x, from as never), to as never);

const unsigned = (x: Node, type: string) => as(x, type, withScalar(type, 'uint'));
const signed = (v: Node, type: string) => as(v, withScalar(type, 'uint'), withScalar(type, 'int'));

function onesIn(v: Node): Node {
  const pairs = tsl(sub)(v, tsl(bitAnd)(tsl(shiftRight)(v, unsignedNode(1)), unsignedNode(0x55555555)));
  const nibbles = tsl(add)(
    tsl(bitAnd)(pairs, unsignedNode(0x33333333)),
    tsl(bitAnd)(tsl(shiftRight)(pairs, unsignedNode(2)), unsignedNode(0x33333333))
  );
  const bytes = tsl(bitAnd)(
    tsl(add)(nibbles, tsl(shiftRight)(nibbles, unsignedNode(4))),
    unsignedNode(0x0f0f0f0f)
  );
  return tsl(shiftRight)(tsl(mul)(bytes, unsignedNode(0x01010101)), unsignedNode(24));
}

function filledBelowTop(v: Node): Node {
  return [1, 2, 4, 8, 16].reduce(
    (filled, shift) => tsl(bitOr)(filled, tsl(shiftRight)(filled, unsignedNode(shift))),
    v
  );
}

export const topBitOf = (v: Node, type: string) =>
  tsl(sub)(signed(onesIn(filledBelowTop(v)), type), intNode(1));

const bitCount: Composite = ([x], [type]) => onesIn(unsigned(x!, type!));

const findLSB: Composite = ([x], [type]) => {
  const v = unsigned(x!, type!);
  return topBitOf(tsl(bitAnd)(v, tsl(sub)(unsignedNode(0), v)), type!);
};

const findMSB: Composite = ([x], [type]) => {
  const v = type!.startsWith('u') ? x! : tsl(bitXor)(x!, tsl(shiftRight)(x!, intNode(31)));
  return topBitOf(unsigned(v, type!), type!);
};

const bitfieldReverse: Composite = ([x], [type]) => {
  const swaps: [number, number][] = [
    [1, 0x55555555],
    [2, 0x33333333],
    [4, 0x0f0f0f0f],
    [8, 0x00ff00ff],
  ];
  const swapped = swaps.reduce(
    (v, [shift, mask]) =>
      tsl(bitOr)(
        tsl(bitAnd)(tsl(shiftRight)(v, unsignedNode(shift)), unsignedNode(mask)),
        tsl(shiftLeft)(tsl(bitAnd)(v, unsignedNode(mask)), unsignedNode(shift))
      ),
    unsigned(x!, type!)
  );
  return tsl(bitOr)(tsl(shiftRight)(swapped, unsignedNode(16)), tsl(shiftLeft)(swapped, unsignedNode(16)));
};

// A shift by 32 is undefined, so a 0-bit field is selected apart.
const bitfieldExtract: Composite = ([value, offset, bits], [type]) => {
  const room = tsl(sub)(intNode(32), bits!);
  const atTop = tsl(shiftLeft)(tsl(shiftRight)(unsigned(value!, type!), offset!), room);
  const field = tsl(shiftRight)(as(atTop, withScalar(type!, 'uint'), type!), room);
  return tsl(select)(tsl(equal)(bits!, intNode(0)), as(unsignedNode(0), 'uint', type!), field);
};

const fieldMask = (offset: Node, bits: Node) =>
  tsl(shiftLeft)(tsl(shiftRight)(unsignedNode(0xffffffff), tsl(sub)(intNode(32), bits)), offset);

const bitfieldInsert: Composite = ([base, insert, offset, bits], [type]) => {
  const mask = fieldMask(offset!, bits!);
  const unsignedBase = unsigned(base!, type!);
  const kept = tsl(bitAnd)(unsignedBase, tsl(bitNot)(mask));
  const inserted = tsl(bitAnd)(tsl(shiftLeft)(unsigned(insert!, type!), offset!), mask);
  return tsl(select)(tsl(equal)(bits!, intNode(0)), unsignedBase, tsl(bitOr)(kept, inserted));
};

const uaddCarry: Composite = ([x, y, carry], [type]) => {
  const sum = tsl(add)(x!, y!);
  chained(carry!).assign(as(tsl(lessThan)(sum, x!), withScalar(type!, 'bool'), type!));
  return sum;
};

const usubBorrow: Composite = ([x, y, borrow], [type]) => {
  chained(borrow!).assign(as(tsl(lessThan)(x!, y!), withScalar(type!, 'bool'), type!));
  return tsl(sub)(x!, y!);
};

const low16 = (v: Node) => tsl(bitAnd)(v, unsignedNode(0xffff));
const high16 = (v: Node) => tsl(shiftRight)(v, unsignedNode(16));

function highProduct(x: Node, y: Node): Node {
  const [xLow, xHigh, yLow, yHigh] = [low16(x), high16(x), low16(y), high16(y)];
  const lowCross = tsl(mul)(xLow, yHigh);
  const highCross = tsl(mul)(xHigh, yLow);
  const middle = tsl(add)(tsl(add)(high16(tsl(mul)(xLow, yLow)), low16(lowCross)), low16(highCross));
  return [high16(lowCross), high16(highCross), high16(middle)].reduce(
    (sum, part) => tsl(add)(sum, part),
    tsl(mul)(xHigh, yHigh)
  );
}

const umulExtended: Composite = ([x, y, msb, lsb]) => {
  chained(msb!).assign(highProduct(x!, y!));
  return chained(lsb!).assign(tsl(mul)(x!, y!));
};

// Signed high half: the unsigned one less each operand where the other is negative.
const imulExtended: Composite = ([x, y, msb, lsb], [type]) => {
  const [ux, uy] = [unsigned(x!, type!), unsigned(y!, type!)];
  const ifNegative = (sign: Node, other: Node) =>
    tsl(bitAnd)(unsigned(tsl(shiftRight)(sign, intNode(31)), type!), other);
  const high = tsl(sub)(tsl(sub)(highProduct(ux, uy), ifNegative(x!, uy)), ifNegative(y!, ux));
  chained(msb!).assign(signed(high, type!));
  return chained(lsb!).assign(tsl(mul)(x!, y!));
};

export const INTEGER_COMPOSITES: Readonly<Record<string, Composite>> = {
  bitCount,
  findLSB,
  findMSB,
  bitfieldReverse,
  bitfieldExtract,
  bitfieldInsert,
  uaddCarry,
  usubBorrow,
  umulExtended,
  imulExtended,
};
