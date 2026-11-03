/**
 * Builds the `name` table that FreeType reads a family name from, for tests of the family name and
 * of the tricky-font check.
 */

import { ByteWriter } from './sfntOutlines.testkit';
import { sfntFileOfTables, type SfntFile } from './sfntTables';

export interface NameRecordSpec {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  string: readonly number[];
}

/** The spec's name IDs, kept apart from the reader's own so a wrong value there fails a test. */
export const NAME_ID_FONT_FAMILY = 1;
export const NAME_ID_TYPOGRAPHIC_FAMILY = 16;
export const NAME_ID_WWS_FAMILY = 21;

const WINDOWS_ENGLISH_US = 0x409;

/** A Windows Unicode BMP record of `text` in UTF-16BE. */
export function windowsName(nameID: number, text: string, languageID = WINDOWS_ENGLISH_US): NameRecordSpec {
  const string = new ByteWriter();
  for (let index = 0; index < text.length; index++) string.u16(text.charCodeAt(index));
  return { platformID: 3, encodingID: 1, languageID, nameID, string: string.toBytes() };
}

/** A Macintosh Roman record of `text` in English, one byte a character. */
export function macintoshName(nameID: number, text: string): NameRecordSpec {
  return {
    platformID: 1,
    encodingID: 0,
    languageID: 0,
    nameID,
    string: Array.from(text, (c) => c.charCodeAt(0)),
  };
}

/**
 * A `name` table of `records`, their strings laid out in order after the records. With
 * `languageTags`, a format 1 table whose tag strings follow the record strings.
 */
export function nameTableOf(
  records: readonly NameRecordSpec[],
  languageTags?: readonly string[]
): Uint8Array {
  const tags = (languageTags ?? []).map((tag) => windowsName(0, tag).string);
  const headerLength = 6 + 12 * records.length + (languageTags ? 2 + 4 * tags.length : 0);
  const table = new ByteWriter()
    .u16(languageTags ? 1 : 0)
    .u16(records.length)
    .u16(headerLength);
  let stringOffset = 0;
  for (const { platformID, encodingID, languageID, nameID, string } of records) {
    table.u16(platformID).u16(encodingID).u16(languageID).u16(nameID).u16(string.length).u16(stringOffset);
    stringOffset += string.length;
  }
  if (languageTags) table.u16(tags.length);
  for (const tag of tags) {
    table.u16(tag.length).u16(stringOffset);
    stringOffset += tag.length;
  }
  for (const string of [...records.map((record) => record.string), ...tags]) table.raw(string);
  return Uint8Array.from(table.toBytes());
}

/** A font that holds only a `name` table with the English Windows family name `family`. */
export function fontOfFamily(family: string): SfntFile {
  return sfntFileOfTables(new Map([['name', nameTableOf([windowsName(NAME_ID_FONT_FAMILY, family)])]]));
}
