import { describe, it, expect } from 'vitest';
import { isBinaryResourceType, stripResPrefix } from './resourceProviderUtils';

describe('isBinaryResourceType', () => {
  it('treats known binary resource types as binary regardless of path', () => {
    expect(isBinaryResourceType('Texture2D')).toBe(true);
    expect(isBinaryResourceType('AudioStreamOggVorbis')).toBe(true);
  });

  it('treats a raw font file extension as binary', () => {
    expect(isBinaryResourceType('FontFile', 'res://fonts/Xolonium-Regular.ttf')).toBe(true);
    expect(isBinaryResourceType('FontFile', 'res://fonts/Montserrat.otf')).toBe(true);
    expect(isBinaryResourceType('FontFile', 'res://fonts/Recursive.woff2')).toBe(true);
    expect(isBinaryResourceType('FontFile', 'res://fonts/Recursive.woff')).toBe(true);
  });

  it('treats a FontFile .tres wrapper as TEXT — the type alone no longer forces binary', () => {
    // A FontFile ExtResource just as often points at a .tres wrapper (carrying
    // `fallbacks`) as at a raw font file; only the extension can tell them apart.
    expect(isBinaryResourceType('FontFile', 'res://theme/fonts/montserrat_extra_bold_32.tres')).toBe(false);
  });

  it('treats an unknown type with no recognised extension as text', () => {
    expect(isBinaryResourceType('SystemFont')).toBe(false);
    expect(isBinaryResourceType('FontVariation', 'res://lib_font.tres')).toBe(false);
  });

  it('falls back to extension when no path is given', () => {
    expect(isBinaryResourceType('Texture2D', undefined)).toBe(true); // type-based
    expect(isBinaryResourceType('SomeUnknownType', undefined)).toBe(false);
  });
});

describe('stripResPrefix', () => {
  it('strips the res:// prefix', () => {
    expect(stripResPrefix('res://scenes/Door.tscn')).toBe('scenes/Door.tscn');
  });

  it('passes through a path without the prefix unchanged', () => {
    expect(stripResPrefix('scenes/Door.tscn')).toBe('scenes/Door.tscn');
  });
});
