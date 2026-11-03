/**
 * The tables of the TrueType interpreter (`ttinterp.c`) that describe each opcode: the stack
 * values it pops and pushes, and the bytes it takes in the instruction stream.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

/**
 * Rows of 16 opcodes, as `Pop_Push_Count` packs them: `PACK( pops, pushes )` as two digits, so
 * `21` pops two values and pushes one.
 */
const POP_PUSH_ROWS: readonly string[] = [
  // 0x00 SVTCA..ISECT
  '00 00 00 00 00 00 20 20 20 20 20 20 02 02 00 50',
  // 0x10 SRP0..SSW
  '10 10 10 10 10 10 10 10 00 00 10 00 10 10 10 10',
  // 0x20 DUP..MDAP
  '12 10 00 22 01 11 10 20 00 10 20 10 10 00 10 10',
  // 0x30 IUP..MIAP; SHP, IP and ALIGNRP pop their points by the loop count, SHPIX after its distance
  '00 00 00 00 10 10 10 10 10 00 20 20 00 00 20 20',
  // 0x40 NPUSHB..DEBUG
  '00 00 20 11 20 11 11 11 20 21 21 01 01 00 00 10',
  // 0x50 LT..SDS
  '21 21 21 21 21 21 11 11 10 00 21 21 11 10 10 10',
  // 0x60 ADD..NROUND
  '21 21 21 21 11 11 11 11 11 11 11 11 11 11 11 11',
  // 0x70 WCVTF..AA
  '20 10 10 10 10 10 10 10 20 20 00 00 00 00 10 10',
  // 0x80 FLIPPT..INSTCTRL
  '00 20 20 00 00 10 20 20 11 10 33 21 21 10 20 00',
  // 0x90 GETVARIATION pushes by the axis count itself; GETDATA pushes one
  '00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00',
];

function popPushCounts(): { pops: Uint8Array; pushes: Uint8Array } {
  const pops = new Uint8Array(256);
  const pushes = new Uint8Array(256);
  POP_PUSH_ROWS.flatMap((row) => row.split(' ')).forEach(([pop, push], opcode) => {
    pops[opcode] = Number(pop);
    pushes[opcode] = Number(push);
  });
  // 0xA0-0xAF pop and push nothing; PUSHB[n] and PUSHW[n] push n + 1; MDRP pops one, MIRP two.
  for (let n = 0; n < 8; n++) {
    pushes[0xb0 + n] = n + 1;
    pushes[0xb8 + n] = n + 1;
  }
  pops.fill(1, 0xc0, 0xe0);
  pops.fill(2, 0xe0, 0x100);
  return { pops, pushes };
}

/** `Pop_Push_Count`, split: the stack values each opcode pops and pushes. */
export const { pops: OPCODE_POPS, pushes: OPCODE_PUSHES } = popPushCounts();

/**
 * `opcode_length`: the bytes of each opcode in the instruction stream. NPUSHB and NPUSHW hold a
 * negative number: their length is `2 - length * count`, from the count byte that follows.
 */
export const OPCODE_LENGTH: Int8Array = (() => {
  const lengths = new Int8Array(256).fill(1);
  lengths[0x40] = -1;
  lengths[0x41] = -2;
  for (let n = 0; n < 8; n++) {
    lengths[0xb0 + n] = n + 2;
    lengths[0xb8 + n] = 2 * n + 3;
  }
  return lengths;
})();
