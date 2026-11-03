/**
 * Builds the `name` and `OS/2` tables that FreeType reads a family name from, for tests of the
 * family name and of the tricky-font check.
 */

export interface NameRecordSpec {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  string: Uint8Array;
}

export const NAME_ID_FONT_FAMILY = 1;
export const NAME_ID_TYPOGRAPHIC_FAMILY = 16;
export const NAME_ID_WWS_FAMILY = 21;

const WINDOWS_ENGLISH_US = 0x409;

/** A Windows Unicode BMP record of `text` in UTF-16BE. */
export function windowsName(nameID: number, text: string, languageID = WINDOWS_ENGLISH_US): NameRecordSpec {
  const string = new Uint8Array(2 * text.length);
  const view = new DataView(string.buffer);
  for (let index = 0; index < text.length; index++) view.setUint16(2 * index, text.charCodeAt(index), false);
  return { platformID: 3, encodingID: 1, languageID, nameID, string };
}

/** A Macintosh Roman record of `text`, one byte a character. */
export function macintoshName(nameID: number, text: string, languageID = 0): NameRecordSpec {
  return {
    platformID: 1,
    encodingID: 0,
    languageID,
    nameID,
    string: Uint8Array.from(text, (c) => c.charCodeAt(0)),
  };
}

/** A format 0 `name` table of `records`, their strings laid out in order after the records. */
export function nameTableOf(records: readonly NameRecordSpec[]): Uint8Array {
  const headerLength = 6 + 12 * records.length;
  const stringsLength = records.reduce((sum, { string }) => sum + string.length, 0);
  const table = new Uint8Array(headerLength + stringsLength);
  const view = new DataView(table.buffer);
  view.setUint16(2, records.length, false);
  view.setUint16(4, headerLength, false);
  let stringOffset = 0;
  records.forEach(({ platformID, encodingID, languageID, nameID, string }, index) => {
    const at = 6 + 12 * index;
    [platformID, encodingID, languageID, nameID, string.length, stringOffset].forEach((field, k) =>
      view.setUint16(at + 2 * k, field, false)
    );
    table.set(string, headerLength + stringOffset);
    stringOffset += string.length;
  });
  return table;
}

/** An `OS/2` table of version 0's 78 bytes with `fsSelection` set. */
export function os2TableOf(fsSelection: number): Uint8Array {
  const table = new Uint8Array(78);
  new DataView(table.buffer).setUint16(62, fsSelection, false);
  return table;
}
