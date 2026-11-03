import { describe, expect, it } from 'vitest';
import { isNativelyHinted } from './glyphHinting';
import { nameTableOf, NAME_ID_FONT_FAMILY, windowsName } from './sfntFamilyName.testkit';
import { sfntFileOfTables, type SfntFile } from './sfntTables';
import { isTrickyFont } from './trickyFont';

function fontOfFamily(family: string): SfntFile {
  return sfntFileOfTables(new Map([['name', nameTableOf([windowsName(NAME_ID_FONT_FAMILY, family)])]]));
}

/** A table of `length` bytes whose words sum to `checksum`. */
function tableWithChecksum(checksum: number, length: number): Uint8Array {
  const table = new Uint8Array(length);
  new DataView(table.buffer).setUint32(0, checksum, false);
  return table;
}

/** The `fpgm` and `prep` of NEC's fadpop7.ttf, which has no `cvt `, by FreeType's checksums. */
const FADPOP7_TABLES: readonly [string, Uint8Array][] = [
  ['fpgm', tableWithChecksum(0x40c92555, 0xe5)],
  ['prep', tableWithChecksum(0xa39b58e3, 0x117c)],
];

describe('isTrickyFont', () => {
  it('flags a font whose family name holds a listed name', () => {
    expect(isTrickyFont(fontOfFamily('MingLiU'))).toBe(true);
    expect(isTrickyFont(fontOfFamily('DFKaiShu-SB-Estd-BF'))).toBe(true);
  });

  it('does not flag a font of another family', () => {
    expect(isTrickyFont(fontOfFamily('Open Sans'))).toBe(false);
  });

  it('skips the subset tag of a font embedded in a PDF', () => {
    expect(isTrickyFont(fontOfFamily('ABCDEF+MingLiU'))).toBe(true);
    expect(isTrickyFont(fontOfFamily('DLCABC+Open Sans'))).toBe(false);
  });

  it('keeps a subset tag with nothing after it, which then matches as a name', () => {
    expect(isTrickyFont(fontOfFamily('DLCABC+'))).toBe(true);
  });

  it('flags a font whose cvt, fpgm and prep match a listed face, a missing table by zero length', () => {
    expect(isTrickyFont(sfntFileOfTables(new Map(FADPOP7_TABLES)))).toBe(true);
  });

  it('does not flag a font with a table the listed face does not have', () => {
    const tables = new Map([...FADPOP7_TABLES, ['cvt ', new Uint8Array(4)]]);

    expect(isTrickyFont(sfntFileOfTables(tables))).toBe(false);
  });

  it('does not flag a font whose table differs from the listed checksum', () => {
    const tables = new Map([...FADPOP7_TABLES, ['prep', tableWithChecksum(0xa39b58e4, 0x117c)]]);

    expect(isTrickyFont(sfntFileOfTables(tables))).toBe(false);
  });
});

describe('isNativelyHinted', () => {
  it('runs the native hinter on a tricky font with no programs, which FreeType never auto-hints', () => {
    expect(isNativelyHinted(fontOfFamily('MingLiU'))).toBe(true);
    expect(isNativelyHinted(fontOfFamily('Open Sans'))).toBe(false);
  });
});
