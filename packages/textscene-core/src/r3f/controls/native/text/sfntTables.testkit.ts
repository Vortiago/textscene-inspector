/** Builds the sfnt tables that tests of the table readers and of the family name read. */

/** An `OS/2` table of version 0's 78 bytes with the given fields, and zero in the rest. */
export function os2Table(fields: {
  fsSelection?: number;
  typoAscender?: number;
  typoDescender?: number;
  winAscent?: number;
  winDescent?: number;
}): Uint8Array {
  const table = new Uint8Array(78);
  const dv = new DataView(table.buffer);
  dv.setUint16(62, fields.fsSelection ?? 0, false);
  dv.setInt16(68, fields.typoAscender ?? 0, false);
  dv.setInt16(70, fields.typoDescender ?? 0, false);
  dv.setUint16(74, fields.winAscent ?? 0, false);
  dv.setUint16(76, fields.winDescent ?? 0, false);
  return table;
}
