import { describe, it, expect } from 'vitest';
import { fontContainerMimeType, fontResourceFromBytes, isFontContainerPath } from './fontBytes';

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

describe('fontContainerMimeType', () => {
  it('maps every font extension to its mime type', () => {
    expect(fontContainerMimeType('res://a.ttf')).toBe('font/ttf');
    expect(fontContainerMimeType('res://a.otf')).toBe('font/otf');
    expect(fontContainerMimeType('res://a.woff')).toBe('font/woff');
    expect(fontContainerMimeType('res://a.woff2')).toBe('font/woff2');
  });

  it('returns undefined for a non-font extension', () => {
    expect(fontContainerMimeType('res://a.png')).toBeUndefined();
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
