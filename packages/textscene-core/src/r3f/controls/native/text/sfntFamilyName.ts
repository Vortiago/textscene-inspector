/**
 * The family name of a font as FreeType gives it (`sfobjs.c`, `sfnt_load_face`, `tt_face_get_name`
 * and the name converters, and `ttload.c`, `tt_face_load_name`): one `name` record, chosen by
 * platform and language, with every character outside printable ASCII read as `?`.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  OS2_FS_SELECTION_OFFSET,
  OS2_TABLE_MIN_LENGTH,
  tableFits,
  type SfntFile,
  type TableRecord,
} from './sfntTables';

/** `name`: format(2), count(2), storageOffset(2), then 12-byte records. */
const NAME_HEADER_LENGTH = 6;
const NAME_RECORD_LENGTH = 12;
const NAME_FORMAT_WITH_LANGUAGE_TAGS = 1;
const LANGUAGE_TAG_RECORD_LENGTH = 4;

const NAME_ID_FONT_FAMILY = 1;
const NAME_ID_TYPOGRAPHIC_FAMILY = 16;
const NAME_ID_WWS_FAMILY = 21;
const FAMILY_NAME_IDS: ReadonlySet<number> = new Set([
  NAME_ID_FONT_FAMILY,
  NAME_ID_TYPOGRAPHIC_FAMILY,
  NAME_ID_WWS_FAMILY,
]);

const PLATFORM_APPLE_UNICODE = 0;
const PLATFORM_MACINTOSH = 1;
const PLATFORM_ISO = 2;
const PLATFORM_MICROSOFT = 3;
const MAC_ENCODING_ROMAN = 0;
const MAC_LANGUAGE_ENGLISH = 0;
/** The Microsoft encodings whose names are UTF-16BE: symbol, Unicode BMP and UCS-4. */
const MICROSOFT_UTF16_ENCODINGS: ReadonlySet<number> = new Set([0, 1, 10]);
/** The primary language of a Microsoft language ID, whose English is 0x09. */
const MICROSOFT_PRIMARY_LANGUAGE_MASK = 0x3ff;
const MICROSOFT_ENGLISH = 0x009;

/** `OS/2` fsSelection bit 8 marks a WWS-only family. */
const OS2_WWS_ONLY = 1 << 8;

const PRINTABLE_FIRST = 32;
const PRINTABLE_LAST = 127;

interface NameRecord {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  /** The string's bytes, inside the table's storage. */
  string: Uint8Array;
}

/** A format 1 `languageID` at or above this names a language tag record, not a language. */
const FIRST_LANGUAGE_TAG_ID = 0x8000;

/** Where a `name` table's strings may lie, and the string length of each language tag record. */
interface NameStorage {
  start: number;
  limit: number;
  /** Zero for a tag whose string lies outside the storage. Null for format 0, which has no tags. */
  languageTagLengths: readonly number[] | null;
}

/**
 * The storage of `name`: after the records, and after the language tags of format 1. Null when
 * the storage start passes its limit, or the tags run past the font: FreeType reads them past the
 * table's end, and then loads no name.
 */
function nameStorageOf(
  dv: DataView,
  table: TableRecord,
  recordsEnd: number,
  storageOffset: number
): NameStorage | null {
  const limit = table.offset + table.length;
  if (recordsEnd > limit) return null;
  if (dv.getUint16(table.offset, false) !== NAME_FORMAT_WITH_LANGUAGE_TAGS)
    return { start: recordsEnd, limit, languageTagLengths: null };
  if (recordsEnd + 2 > dv.byteLength) return null;
  const tagCount = dv.getUint16(recordsEnd, false);
  const tagsStart = recordsEnd + 2;
  const start = tagsStart + LANGUAGE_TAG_RECORD_LENGTH * tagCount;
  if (start > dv.byteLength) return null;
  const languageTagLengths = Array.from({ length: tagCount }, (_, index) => {
    const at = tagsStart + LANGUAGE_TAG_RECORD_LENGTH * index;
    const length = dv.getUint16(at, false);
    const stringStart = storageOffset + dv.getUint16(at + 2, false);
    return stringStart >= start && stringStart + length <= limit ? length : 0;
  });
  return { start, limit, languageTagLengths };
}

/** Whether a record's language is valid: in format 1, a language tag ID must name a tag with a string. */
function hasValidLanguage({ languageTagLengths }: NameStorage, languageID: number): boolean {
  if (!languageTagLengths || languageID < FIRST_LANGUAGE_TAG_ID) return true;
  return (languageTagLengths[languageID - FIRST_LANGUAGE_TAG_ID] ?? 0) > 0;
}

/**
 * The family records of `name` whose string lies in the table's storage (`tt_face_load_name`).
 * FreeType keeps every record, but the family name reads only these.
 */
function familyRecordsOf({ dv, tables }: SfntFile): NameRecord[] {
  const table = tables.get('name');
  if (!table || !tableFits(dv, table, NAME_HEADER_LENGTH)) return [];
  const count = dv.getUint16(table.offset + 2, false);
  const storageOffset = table.offset + dv.getUint16(table.offset + 4, false);
  const recordsStart = table.offset + NAME_HEADER_LENGTH;
  const storage = nameStorageOf(dv, table, recordsStart + NAME_RECORD_LENGTH * count, storageOffset);
  if (!storage) return [];
  const records: NameRecord[] = [];
  for (let index = 0; index < count; index++) {
    const at = recordsStart + NAME_RECORD_LENGTH * index;
    const languageID = dv.getUint16(at + 4, false);
    const nameID = dv.getUint16(at + 6, false);
    const length = dv.getUint16(at + 8, false);
    const start = storageOffset + dv.getUint16(at + 10, false);
    const isInStorage = length > 0 && start >= storage.start && start + length <= storage.limit;
    if (!FAMILY_NAME_IDS.has(nameID) || !isInStorage || !hasValidLanguage(storage, languageID)) continue;
    records.push({
      platformID: dv.getUint16(at, false),
      encodingID: dv.getUint16(at + 2, false),
      languageID,
      nameID,
      string: new Uint8Array(dv.buffer, dv.byteOffset + start, length),
    });
  }
  return records;
}

/** `tt_name_ascii_from_utf16` and `tt_name_ascii_from_other`: the code units up to the first zero. */
function asciiOf(codes: Iterable<number>): string {
  let name = '';
  for (const code of codes) {
    if (code === 0) break;
    name += code < PRINTABLE_FIRST || code > PRINTABLE_LAST ? '?' : String.fromCharCode(code);
  }
  return name;
}

function* utf16CodeUnits(bytes: Uint8Array): Iterable<number> {
  for (let at = 0; at + 1 < bytes.length; at += 2) yield (bytes[at]! << 8) | bytes[at + 1]!;
}

const isMicrosoftEnglish = ({ languageID }: NameRecord): boolean =>
  (languageID & MICROSOFT_PRIMARY_LANGUAGE_MASK) === MICROSOFT_ENGLISH;

/**
 * `tt_face_get_name`: a Windows name when it is English or the font has no Apple one, else the
 * Apple name, English before Roman, else a Unicode-platform name. Null when no record names `nameID`.
 */
function nameOf(records: readonly NameRecord[], nameID: number): string | null {
  let appleEnglish: NameRecord | null = null;
  let appleRoman: NameRecord | null = null;
  let windows: NameRecord | null = null;
  let unicode: NameRecord | null = null;
  for (const record of records) {
    if (record.nameID !== nameID) continue;
    switch (record.platformID) {
      case PLATFORM_APPLE_UNICODE:
      case PLATFORM_ISO:
        unicode = record;
        break;
      case PLATFORM_MACINTOSH:
        if (record.languageID === MAC_LANGUAGE_ENGLISH) appleEnglish = record;
        else if (record.encodingID === MAC_ENCODING_ROMAN) appleRoman = record;
        break;
      case PLATFORM_MICROSOFT:
        if (
          (windows === null || isMicrosoftEnglish(record)) &&
          MICROSOFT_UTF16_ENCODINGS.has(record.encodingID)
        )
          windows = record;
        break;
    }
  }
  const apple = appleEnglish ?? appleRoman;
  if (windows && !(apple && !isMicrosoftEnglish(windows))) return asciiOf(utf16CodeUnits(windows.string));
  if (apple) return asciiOf(apple.string);
  if (unicode) return asciiOf(utf16CodeUnits(unicode.string));
  return null;
}

/** Whether `OS/2` marks the family as WWS-only, which makes FreeType skip the WWS family name. */
function isWwsOnly({ dv, tables }: SfntFile): boolean {
  const os2 = tables.get('OS/2');
  if (!os2 || !tableFits(dv, os2, OS2_TABLE_MIN_LENGTH)) return false;
  return (dv.getUint16(os2.offset + OS2_FS_SELECTION_OFFSET, false) & OS2_WWS_ONLY) !== 0;
}

/** `sfnt_load_face`'s `family_name`, or null for a font whose `name` table names no family. */
export function familyNameOf(sfnt: SfntFile): string | null {
  const records = familyRecordsOf(sfnt);
  const familyIds = isWwsOnly(sfnt)
    ? [NAME_ID_TYPOGRAPHIC_FAMILY, NAME_ID_FONT_FAMILY]
    : [NAME_ID_WWS_FAMILY, NAME_ID_TYPOGRAPHIC_FAMILY, NAME_ID_FONT_FAMILY];
  for (const nameID of familyIds) {
    const name = nameOf(records, nameID);
    if (name !== null) return name;
  }
  return null;
}
