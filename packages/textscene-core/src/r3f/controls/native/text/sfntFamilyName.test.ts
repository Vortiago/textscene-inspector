import { describe, expect, it } from 'vitest';
import { familyNameOf } from './sfntFamilyName';
import {
  macintoshName,
  nameTableOf,
  NAME_ID_FONT_FAMILY,
  NAME_ID_TYPOGRAPHIC_FAMILY,
  NAME_ID_WWS_FAMILY,
  os2TableOf,
  windowsName,
  type NameRecordSpec,
} from './sfntFamilyName.testkit';
import { sfntFileOfTables } from './sfntTables';

/** `OS/2` fsSelection bit 8: the family is WWS-only. */
const WWS_ONLY = 1 << 8;
const WINDOWS_GERMAN = 0x407;

function familyOf(records: readonly NameRecordSpec[], os2?: Uint8Array): string | null {
  const tables = new Map([['name', nameTableOf(records)]]);
  if (os2) tables.set('OS/2', os2);
  return familyNameOf(sfntFileOfTables(tables));
}

describe('familyNameOf', () => {
  it('reads the family name of a Windows record', () => {
    expect(familyOf([windowsName(NAME_ID_FONT_FAMILY, 'Open Sans')])).toBe('Open Sans');
  });

  it('prefers the WWS family, then the typographic family, to the family', () => {
    const family = windowsName(NAME_ID_FONT_FAMILY, 'Family');
    const typographic = windowsName(NAME_ID_TYPOGRAPHIC_FAMILY, 'Typographic');
    const wws = windowsName(NAME_ID_WWS_FAMILY, 'WWS');

    expect(familyOf([family, typographic, wws])).toBe('WWS');
    expect(familyOf([family, typographic])).toBe('Typographic');
  });

  it('skips the WWS family of a font whose OS/2 marks it WWS-only', () => {
    const records = [
      windowsName(NAME_ID_TYPOGRAPHIC_FAMILY, 'Typographic'),
      windowsName(NAME_ID_WWS_FAMILY, 'WWS'),
    ];

    expect(familyOf(records, os2TableOf(WWS_ONLY))).toBe('Typographic');
  });

  it('reads the WWS family of a font whose OS/2 is shorter than version 0', () => {
    const records = [
      windowsName(NAME_ID_TYPOGRAPHIC_FAMILY, 'Typographic'),
      windowsName(NAME_ID_WWS_FAMILY, 'WWS'),
    ];

    expect(familyOf(records, os2TableOf(WWS_ONLY).subarray(0, 77))).toBe('WWS');
  });

  it('prefers an Apple record to a Windows record that is not English', () => {
    const records = [
      windowsName(NAME_ID_FONT_FAMILY, 'Deutsch', WINDOWS_GERMAN),
      macintoshName(NAME_ID_FONT_FAMILY, 'Apple'),
    ];

    expect(familyOf(records)).toBe('Apple');
  });

  it('prefers an English Windows record to an Apple record', () => {
    const records = [
      macintoshName(NAME_ID_FONT_FAMILY, 'Apple'),
      windowsName(NAME_ID_FONT_FAMILY, 'Windows'),
    ];

    expect(familyOf(records)).toBe('Windows');
  });

  it('reads a character outside printable ASCII as a question mark', () => {
    expect(familyOf([windowsName(NAME_ID_FONT_FAMILY, '華康楷書 W5')])).toBe('???? W5');
  });

  it('answers null for a font with no family name', () => {
    expect(familyOf([])).toBeNull();
    expect(familyNameOf(sfntFileOfTables(new Map()))).toBeNull();
  });
});
