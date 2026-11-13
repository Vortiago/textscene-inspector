/** The `fvar` axes of a font, read once for each font by every reader of its variations. */

import { describe, expect, it, vi } from 'vitest';
import { fixtureSfnt } from '../sfntOutlines.testkit';
import { defaultKerningReader, instanceKerningReader } from './instanceKerning';
import { fontInstanceOf } from './fontInstance';
import { opentypeOf } from '../glyphVariation.testkit';

describe('the fvar axes of a font', () => {
  it('are read once for two kerning readers and an instance', () => {
    const sfnt = fixtureSfnt('open-sans-variable-subset.ttf');
    const readTable = vi.spyOn(sfnt.tables, 'get');

    instanceKerningReader(sfnt);
    defaultKerningReader(sfnt);
    fontInstanceOf(sfnt, opentypeOf({ 2003265652: 700 }));

    expect(readTable.mock.calls.filter(([tag]) => tag === 'fvar')).toHaveLength(1);
  });
});
