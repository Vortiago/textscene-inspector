import { describe, it, expect } from 'vitest';
import { fontResourceFromBytes, isFontContainerPath } from './fontBytes';

describe('isFontContainerPath', () => {
  it('matches raw font file extensions', () => {
    expect(isFontContainerPath('res://fonts/Xolonium-Regular.ttf')).toBe(true);
    expect(isFontContainerPath('res://fonts/Montserrat.otf')).toBe(true);
    expect(isFontContainerPath('res://fonts/Recursive.woff')).toBe(true);
    expect(isFontContainerPath('res://fonts/Recursive.woff2')).toBe(true);
  });

  it('is case-insensitive on extension', () => {
    expect(isFontContainerPath('res://fonts/Xolonium-Regular.TTF')).toBe(true);
  });

  it('rejects a .tres and unrelated extensions', () => {
    expect(isFontContainerPath('res://theme/fonts/montserrat.tres')).toBe(false);
    expect(isFontContainerPath('res://textures/checker.png')).toBe(false);
    expect(isFontContainerPath('res://noext')).toBe(false);
  });
});

/** The mime type `fontResourceFromBytes` stamps on a font at `path`. */
function mimeTypeOf(path: string): string | undefined {
  return fontResourceFromBytes(path, new ArrayBuffer(1)).mimeType;
}

describe('the mime type of a wrapped font', () => {
  it('maps every font extension to its mime type', () => {
    expect(mimeTypeOf('res://a.ttf')).toBe('font/ttf');
    expect(mimeTypeOf('res://a.otf')).toBe('font/otf');
    expect(mimeTypeOf('res://a.woff')).toBe('font/woff');
    expect(mimeTypeOf('res://a.woff2')).toBe('font/woff2');
  });

  it('returns undefined for a non-font extension', () => {
    expect(mimeTypeOf('res://a.png')).toBeUndefined();
  });
});

describe('fontResourceFromBytes', () => {
  it('wraps raw bytes with the derived mime type and no fallbacks', () => {
    const bytes = new ArrayBuffer(4);
    const resource = fontResourceFromBytes('res://fonts/Xolonium-Regular.ttf', bytes);
    expect(resource).toEqual({
      kind: 'file',
      bytes,
      mimeType: 'font/ttf',
      fallbacks: [],
      properties: {},
    });
  });
});
